import { randomUUID } from 'node:crypto'
import type { Adapter } from '../adapter.js'
import { commandOutput, parseJson } from '../cli.js'
import { authEnv, authFailed, configDir, readLogin } from './auth.js'
import { ClaudeOutput } from './output.js'

// 模型用 Claude Code 的别名，总是对应各系列最新的模型；思考程度各个模型都一样
const models = [
  { id: 'fable', name: 'Fable' },
  { id: 'opus', name: 'Opus' },
  { id: 'sonnet', name: 'Sonnet' },
  { id: 'haiku', name: 'Haiku' },
]
const efforts = ['low', 'medium', 'high', 'xhigh', 'max']

type AuthStatus = { loggedIn?: boolean; email?: string; orgName?: string; subscriptionType?: string }
const authStatus = async (env: NodeJS.ProcessEnv) => parseJson<AuthStatus>(await commandOutput('claude', ['auth', 'status', '--json'], env))

export const claude: Adapter = {
  configDir,
  env: { CLAUDE_CONFIG_DIR: configDir },
  inheritedEnv: /^(CLAUDE|ANTHROPIC)/,
  command: ({ sessionId, model, effort, instructions }) => [
    'claude',
    '-p',
    '--input-format', 'stream-json',
    '--permission-mode', 'bypassPermissions',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    // 思考默认只给加密的原文，要这个才给出能显示的摘要
    '--thinking-display', 'summarized',
    // 子 agent 的文字和思考也转发出来，带着 parent_tool_use_id
    '--forward-subagent-text',
    '--chrome',
    ...(instructions ? ['--append-system-prompt', instructions] : []),
    ...(model ? ['--model', model] : []),
    ...(effort ? ['--effort', effort] : []),
    ...(sessionId ? ['--resume', sessionId] : ['--session-id', randomUUID()]),
  ],
  output: (options) => new ClaudeOutput(options),
  viewHint: '用 Read 工具查看',
  models: models.map((model) => model.id),
  efforts,
  catalog: async (env) => ({
    available: (await authStatus(env))?.loggedIn === true,
    models: models.map((model) => ({ ...model, efforts })),
    efforts,
  }),
  account,
  authEnv,
  authFailed,
}

async function account(env: NodeJS.ProcessEnv) {
  const [version, auth] = await Promise.all([commandOutput('claude', ['--version'], env), authStatus(env)])
  const oauth = readLogin()
  return {
    ...(version && { version: version.replace(/\s*\(Claude Code\)$/, '') }),
    loggedIn: auth?.loggedIn === true,
    ...(auth?.email && { email: auth.email }),
    ...(auth?.orgName && { organization: auth.orgName }),
    ...((auth?.subscriptionType ?? oauth?.subscriptionType) && { plan: auth?.subscriptionType ?? oauth?.subscriptionType }),
    ...(oauth && {
      token: { ...(oauth.expiresAt && { expiresAt: new Date(oauth.expiresAt).toISOString() }), refreshable: Boolean(oauth.refreshToken) },
    }),
    configDir,
  }
}
