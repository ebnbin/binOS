import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { agentServiceDir, agentsDir } from '../../../../paths.js'
import { notifyChange } from '../../../../events.js'
import { parseJson, readText } from '../../cli.js'
import type { CodexAuth } from '../../types.js'

export const configDir = path.join(agentsDir, 'codex')

// 认证失败过的登录：记的是刷新令牌的指纹，重新登录后令牌变了就不算了
const brokenPath = path.join(agentServiceDir, 'codex-login-broken')

type Tokens = { access_token?: string; refresh_token?: string }

const readTokens = () => parseJson<{ tokens?: Tokens }>(readText(path.join(configDir, 'auth.json')))?.tokens

const fingerprint = (tokens: Tokens) =>
  createHash('sha256')
    .update(tokens.refresh_token ?? tokens.access_token ?? '')
    .digest('hex')
    .slice(0, 16)

function currentAuth(): CodexAuth {
  const tokens = readTokens()
  if (!tokens) {
    return { loggedIn: false }
  }
  let broken = false
  try {
    broken = readFileSync(brokenPath, 'utf8').trim() === fingerprint(tokens)
  } catch {
    // 没失效过
  }
  return { loggedIn: true, ...(broken && { broken: true as const }) }
}

// 上次看到的状况：变了就通知页面重新读取
let lastSeen: string | undefined

export function codexAuth(): CodexAuth {
  const auth = currentAuth()
  const text = JSON.stringify(auth)
  if (lastSeen !== undefined && text !== lastSeen) {
    notifyChange({ type: 'agent' })
  }
  lastSeen = text
  return auth
}

// 回答时请求被拒绝（401）：记下这份登录失效了。返回给用户看的原因
export function codexAuthFailed(): string {
  const tokens = readTokens()
  if (tokens) {
    mkdirSync(path.dirname(brokenPath), { recursive: true })
    writeFileSync(brokenPath, fingerprint(tokens))
  }
  codexAuth()
  return 'Codex 的登录失效了，去「系统」→ Agent 重新登录'
}
