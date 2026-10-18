import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { claudeConfigDir, codexHome } from '../../paths.js'
import { agentEnv } from './agent-process.js'
import { askCodex, codexLimits } from './codex.js'
import type { RateLimits } from './codex.js'
import { listSessions, sessionInfo } from './sessions.js'
import { isAnswering, saveLimits } from './turns.js'
import type { AgentAccount, Provider } from './types.js'

const run = promisify(execFile)
const timeout = 15_000

async function output(command: string, args: string[]): Promise<string | undefined> {
  try {
    return (await run(command, args, { env: agentEnv(), timeout })).stdout.trim()
  } catch {
    return undefined
  }
}

function sessionCounts(provider: Provider) {
  const ids = listSessions().filter((id) => sessionInfo(id).provider === provider)
  return { sessions: ids.length, running: ids.filter(isAnswering).length }
}

const isoFromSeconds = (seconds: number | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : undefined)

export async function agentAccounts(): Promise<AgentAccount[]> {
  return Promise.all([claudeAccount(), codexAccount()])
}

// 配置目录不是默认的时，Claude Code 把凭证存在钥匙串里以目录路径的哈希区分的一项
async function claudeAccount(): Promise<AgentAccount> {
  const [version, status, credentials] = await Promise.all([
    output('claude', ['--version']),
    output('claude', ['auth', 'status', '--json']),
    output('security', [
      'find-generic-password',
      '-s',
      `Claude Code-credentials-${createHash('sha256').update(claudeConfigDir).digest('hex').slice(0, 8)}`,
      '-w',
    ]),
  ])
  const auth = parse<{ loggedIn?: boolean; email?: string; orgName?: string; subscriptionType?: string }>(status)
  const oauth = parse<{ claudeAiOauth?: { expiresAt?: number; refreshToken?: string; subscriptionType?: string } }>(credentials)?.claudeAiOauth
  return {
    provider: 'claude',
    ...(version && { version: version.replace(/\s*\(Claude Code\)$/, '') }),
    loggedIn: auth?.loggedIn === true,
    ...(auth?.email && { email: auth.email }),
    ...(auth?.orgName && { organization: auth.orgName }),
    ...((auth?.subscriptionType ?? oauth?.subscriptionType) && { plan: auth?.subscriptionType ?? oauth?.subscriptionType }),
    ...(oauth && {
      token: { ...(oauth.expiresAt && { expiresAt: new Date(oauth.expiresAt).toISOString() }), refreshable: Boolean(oauth.refreshToken) },
    }),
    configDir: claudeConfigDir,
    ...sessionCounts('claude'),
  }
}

type CodexAuth = { tokens?: { access_token?: string; refresh_token?: string }; last_refresh?: string }
type ResetCredit = { status: string; expiresAt: number | null }

// 访问令牌是 JWT，过期时间直接从里面读，不校验签名
async function codexAccount(): Promise<AgentAccount> {
  const [version, live] = await Promise.all([
    output('codex', ['--version']),
    askCodex(
      async (request) => {
        const [account, limits] = await Promise.all([
          request<{ account: { email?: string; planType?: string } | null }>('account/read', {}),
          request<{ rateLimits?: RateLimits; rateLimitResetCredits?: { credits: ResetCredit[] } | null }>('account/rateLimits/read', {}),
        ])
        return { account: account?.account ?? undefined, limits }
      },
      { account: undefined, limits: undefined },
    ),
  ])
  const snapshot = live.limits?.rateLimits && codexLimits(live.limits.rateLimits, new Date().toISOString())
  if (snapshot) {
    saveLimits('codex', snapshot)
  }
  const auth = parse<CodexAuth>(readText(path.join(codexHome, 'auth.json')))
  const expiresAt = isoFromSeconds(jwtClaims(auth?.tokens?.access_token)?.exp)
  const credits = (live.limits?.rateLimitResetCredits?.credits ?? []).filter((credit) => credit.status === 'available')
  const firstExpiry = Math.min(...credits.flatMap((credit) => (credit.expiresAt ? [credit.expiresAt] : [])))
  return {
    provider: 'codex',
    ...(version && { version: version.replace(/^codex-cli\s*/, '') }),
    loggedIn: live.account !== undefined,
    ...(live.account?.email && { email: live.account.email }),
    ...(live.account?.planType && { plan: live.account.planType }),
    ...(auth?.tokens && {
      token: {
        ...(expiresAt && { expiresAt }),
        ...(auth.last_refresh && { refreshedAt: auth.last_refresh }),
        refreshable: Boolean(auth.tokens.refresh_token),
      },
    }),
    ...(credits.length > 0 && { resetCredits: { count: credits.length, ...(Number.isFinite(firstExpiry) && { expiresAt: isoFromSeconds(firstExpiry) }) } }),
    configDir: codexHome,
    ...sessionCounts('codex'),
  }
}

function readText(file: string): string | undefined {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return undefined
  }
}

function parse<T>(text: string | undefined): T | undefined {
  try {
    return text ? (JSON.parse(text) as T) : undefined
  } catch {
    return undefined
  }
}

function jwtClaims(token: string | undefined): { exp?: number } | undefined {
  return parse(token ? Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8') : undefined)
}
