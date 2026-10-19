import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'
import { previewsDir, repoDir } from '../../paths.js'
import { previewInfoPath, previewDirName, previewUrl } from '../../preview-info.js'
import type { PullRequest } from './types.js'

const run = promisify(execFile)

// 每个仓库的 PR 状态最多这么久查一次
const refreshInterval = 60_000

type PrState = { state: PullRequest['state']; title: string }
type RepoCache = { checkedAt: number; prs: Map<string, PrState>; refreshing?: Promise<void> }
const repos = new Map<string, RepoCache>()

// binOS 自己的仓库（owner/name），它的 PR 才有预览
let ownRepo: Promise<string | undefined> | undefined

function binosRepo() {
  ownRepo ??= run('git', ['remote', 'get-url', 'origin'], { cwd: repoDir })
    .then(({ stdout }) => /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(stdout.trim())?.[1])
    .catch(() => undefined)
  return ownRepo
}

const repoOf = (url: string) => /github\.com\/([\w.-]+\/[\w.-]+)\/pull\/\d+/.exec(url)?.[1]

// 一个仓库的 PR 一次查完；查到的状态有变化时调用 onChange
function refresh(repo: string, onChange: () => void) {
  const cache: RepoCache = repos.get(repo) ?? { checkedAt: 0, prs: new Map() }
  repos.set(repo, cache)
  if (cache.refreshing || Date.now() - cache.checkedAt < refreshInterval) {
    return
  }
  cache.refreshing = run('gh', ['pr', 'list', '--repo', repo, '--state', 'all', '--limit', '300', '--json', 'url,state,title'])
    .then(({ stdout }) => {
      const prs = new Map<string, PrState>()
      for (const pr of JSON.parse(stdout) as { url: string; state: string; title: string }[]) {
        prs.set(pr.url, { state: pr.state.toLowerCase() as PullRequest['state'], title: pr.title })
      }
      const changed = JSON.stringify([...prs]) !== JSON.stringify([...cache.prs])
      cache.prs = prs
      if (changed) {
        onChange()
      }
    })
    .catch(() => {
      // 查不到就先不显示状态，下次再查
    })
    .finally(() => {
      cache.checkedAt = Date.now()
      cache.refreshing = undefined
    })
}

// 这些 PR 现在的状态：用缓存的，过期了在后台重新查；开着的 binOS 自己的 PR 有预览在运行时带上预览地址
export async function pullRequests(urls: string[], onChange: () => void): Promise<PullRequest[]> {
  const own = await binosRepo()
  return urls.map((url) => {
    const repo = repoOf(url)
    if (repo) {
      refresh(repo, onChange)
    }
    const number = Number(url.split('/').at(-1))
    const known = repo ? repos.get(repo)?.prs.get(url) : undefined
    const preview =
      known?.state === 'open' && repo === own && existsSync(previewInfoPath(previewsDir, previewDirName(number))) ? previewUrl(number) : undefined
    return { url, number, ...known, ...(preview && { preview }) }
  })
}
