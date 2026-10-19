import { createHash, randomUUID } from 'node:crypto'
import { claudeConfigDir } from '../../../paths.js'
import type { Adapter } from '../adapter.js'
import { commandOutput, parseJson } from '../cli.js'
import { claudeEfforts, claudeModels } from '../types.js'
import { ClaudeOutput } from './output.js'

export const claude: Adapter = {
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
  models: claudeModels,
  efforts: claudeEfforts,
  account,
}

// 配置目录不是默认的时，Claude Code 把凭证存在钥匙串里以目录路径的哈希区分的一项
async function account() {
  const [version, status, credentials] = await Promise.all([
    commandOutput('claude', ['--version']),
    commandOutput('claude', ['auth', 'status', '--json']),
    commandOutput('security', [
      'find-generic-password',
      '-s',
      `Claude Code-credentials-${createHash('sha256').update(claudeConfigDir).digest('hex').slice(0, 8)}`,
      '-w',
    ]),
  ])
  const auth = parseJson<{ loggedIn?: boolean; email?: string; orgName?: string; subscriptionType?: string }>(status)
  const oauth = parseJson<{ claudeAiOauth?: { expiresAt?: number; refreshToken?: string; subscriptionType?: string } }>(credentials)?.claudeAiOauth
  return {
    ...(version && { version: version.replace(/\s*\(Claude Code\)$/, '') }),
    loggedIn: auth?.loggedIn === true,
    ...(auth?.email && { email: auth.email }),
    ...(auth?.orgName && { organization: auth.orgName }),
    ...((auth?.subscriptionType ?? oauth?.subscriptionType) && { plan: auth?.subscriptionType ?? oauth?.subscriptionType }),
    ...(oauth && {
      token: { ...(oauth.expiresAt && { expiresAt: new Date(oauth.expiresAt).toISOString() }), refreshable: Boolean(oauth.refreshToken) },
    }),
    configDir: claudeConfigDir,
  }
}
