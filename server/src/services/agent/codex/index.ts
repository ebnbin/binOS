import path from 'node:path'
import type { Adapter } from '../adapter.js'
import { commandOutput, isoFromSeconds, parseJson, readText } from '../cli.js'
import { saveLimits } from '../limits.js'
import { askCodex, codexCatalog, codexLimits } from './app-server.js'
import type { RateLimits } from './app-server.js'
import { codexAuthFailed, configDir } from './auth.js'
import { CodexOutput } from './output.js'

// 转接进程和这个模块在一起，开发时是 .ts
const bridge = path.join(import.meta.dirname, `bridge${path.extname(import.meta.filename)}`)

export const codex: Adapter = {
  configDir,
  env: { CODEX_HOME: configDir },
  inheritedEnv: /^(CODEX|OPENAI)/,
  command: ({ sessionId, model, effort, instructions }) => [
    process.execPath,
    bridge,
    JSON.stringify({ threadId: sessionId, model, effort, instructions }),
  ],
  output: (options) => new CodexOutput(options),
  viewHint: '自己查看，图片用 view_image 工具',
  partialLimits: true,
  // 不指定模型时能选的是默认模型的思考程度。顺便更新额度
  catalog: async (env) => {
    const { limits, ...catalog } = await codexCatalog(env)
    if (limits) {
      saveLimits('codex', limits)
    }
    return { ...catalog, efforts: catalog.models.find((model) => model.isDefault)?.efforts ?? [] }
  },
  account,
  authFailed: codexAuthFailed,
}

type CodexAuth = { tokens?: { access_token?: string; refresh_token?: string }; last_refresh?: string }
type ResetCredit = { status: string; expiresAt: number | null }

// 访问令牌是 JWT，过期时间直接从里面读，不校验签名
async function account(env: NodeJS.ProcessEnv) {
  const [version, live] = await Promise.all([
    commandOutput('codex', ['--version'], env),
    askCodex(
      env,
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
  const auth = parseJson<CodexAuth>(readText(path.join(configDir, 'auth.json')))
  const expiresAt = isoFromSeconds(jwtClaims(auth?.tokens?.access_token)?.exp)
  const credits = (live.limits?.rateLimitResetCredits?.credits ?? []).filter((credit) => credit.status === 'available')
  const firstExpiry = Math.min(...credits.flatMap((credit) => (credit.expiresAt ? [credit.expiresAt] : [])))
  return {
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
    configDir,
  }
}

function jwtClaims(token: string | undefined): { exp?: number } | undefined {
  return parseJson(token ? Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8') : undefined)
}
