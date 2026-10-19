import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { agentRunsDir, appDir, libraryDir } from './paths.js'

// 后端启动时、各 app 启动前执行的数据迁移。每一步都先看是否已经做过，可以重复执行
export function migrate() {
  moveCodeToApps()
}

// Code 的数据从 Library/code 挪到 Library/Apps/code。进行中的 agent 运行记着工具结果图片的存放目录，跟着改
function moveCodeToApps() {
  const from = path.join(libraryDir, 'code')
  const to = appDir('code')
  if (existsSync(from) && !existsSync(to)) {
    mkdirSync(path.dirname(to), { recursive: true })
    renameSync(from, to)
  }

  if (!existsSync(agentRunsDir)) {
    return
  }
  const prefix = from + path.sep
  for (const id of readdirSync(agentRunsDir)) {
    const file = path.join(agentRunsDir, id, 'state.json')
    const state = readJson<{ options: { filesDir: string } }>(file)
    const filesDir = state?.options.filesDir
    if (filesDir?.startsWith(prefix)) {
      const options = { ...state!.options, filesDir: path.join(to, filesDir.slice(prefix.length)) }
      writeFileSync(`${file}.tmp`, JSON.stringify({ ...state, options }) + '\n')
      renameSync(`${file}.tmp`, file)
    }
  }
}

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}
