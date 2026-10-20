import type { CodexAuth } from '@binos/server/services/agent/types'
import type { AgentView } from '../views.ts'
import { CodexLogin } from './Login.tsx'

// Codex 只在回答时认证失败过才提醒：没登录过 Codex 也照样能用别的 agent
export const codexView: AgentView<CodexAuth> = {
  attention: (auth) => (auth?.broken ? { text: 'Codex 的登录失效了，回答时认证失败了', tone: 'bad', action: '重新登录', fix: 'login' } : undefined),
  authRows: () => [],
  loginActions: (auth) => [{ label: auth?.loggedIn ? '重新登录' : '登录', fix: 'login' }],
  Login: ({ onClose }) => <CodexLogin onClose={onClose} />,
  // gpt-6.1-sol → GPT-6.1-Sol
  modelName: (model) =>
    model.startsWith('gpt-') ? model.split('-').map((part, i) => (i === 0 ? 'GPT' : part[0].toUpperCase() + part.slice(1))).join('-') : model,
}
