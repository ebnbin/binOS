import type { ClaudeAuth } from '@binos/server/services/agent/types'
import { formatMoment } from '../../../ui/time.ts'
import { daysLeft } from '../auth.ts'
import type { AgentView } from '../views.ts'
import type { ClaudeLoginKind } from './api.ts'
import { ClaudeAccounts } from './Accounts.tsx'
import { ClaudeLogin } from './Login.tsx'

const day = 86_400_000
// 完整登录剩不到这么多天时提醒重新登录，备用 token 剩不到这么多天时提醒更新
const loginWarnDays = 7
const backupWarnDays = 30

// Claude 的两份登录（见 ClaudeAuth）：正在用哪份、各自什么时候到期，可以重新登录、生成备用 token
export const claudeView: AgentView<ClaudeAuth> = {
  attention(auth, now) {
    if (!auth) {
      return undefined
    }
    if (auth.account && auth.account !== 'main') {
      return auth.mode === 'none' ? { text: `Claude 账号 ${auth.account} 没有可用的令牌，请在系统中更新或切换账号`, tone: 'bad', action: '管理账号', fix: 'accounts' } : undefined
    }
    if (auth.mode === 'none') {
      return { text: 'Claude 没有能用的登录', tone: 'bad', action: '重新登录', fix: 'login' }
    }
    if (auth.mode === 'token') {
      const text = auth.login?.broken ? 'Claude 的登录失效了，正在用备用 token' : 'Claude 的登录过期了，正在用备用 token'
      return { text, tone: 'warn', action: '重新登录', fix: 'login' }
    }
    const loginExpiry = auth.login?.expiresAt
    if (loginExpiry && Date.parse(loginExpiry) - now < loginWarnDays * day) {
      const days = daysLeft(loginExpiry, now)
      return { text: `Claude 的登录${days === 0 ? '今天' : `还有 ${days} 天`}到期`, tone: 'warn', action: '重新登录', fix: 'login' }
    }
    const backupExpiry = auth.backup?.expiresAt
    if (backupExpiry && Date.parse(backupExpiry) - now < backupWarnDays * day) {
      return { text: `Claude 的备用 token 还有 ${daysLeft(backupExpiry, now)} 天到期`, tone: 'warn', action: '更新', fix: 'token' }
    }
    return undefined
  },

  authRows(auth, now) {
    if (!auth) {
      return []
    }
    if (auth.account && auth.account !== 'main') return [{ label: '正在用', value: auth.account, note: '长期 token，只能回答，没有 claude.ai 的连接器' }]
    const { login: full, backup } = auth
    const fullExpired = full?.expiresAt !== undefined && Date.parse(full.expiresAt) <= now
    return [
      { label: '正在用', value: { login: '完整登录', token: '备用 token', none: '没有能用的登录' }[auth.mode], expired: auth.mode === 'none' },
      {
        label: '完整登录',
        value: !full ? '没有' : full.broken ? '已失效' : full.expiresAt ? (fullExpired ? '已过期' : `还有 ${daysLeft(full.expiresAt, now)} 天`) : '已登录',
        note: full?.expiresAt && !full.broken ? `${formatMoment(full.expiresAt, now)}到期，之后只能重新登录` : '回答时认证失败了，重新登录后自动换回来',
        expired: !full || Boolean(full.broken) || fullExpired,
      },
      {
        label: '备用 token',
        value: backup ? (backup.expiresAt ? `还有 ${daysLeft(backup.expiresAt, now)} 天` : '已存好') : '没有',
        note: '完整登录过期或失效时自动换用，只能回答，没有 claude.ai 的连接器',
      },
    ]
  },

  loginActions: (auth) =>
    auth
      ? auth.account && auth.account !== 'main' ? [] : [
          { label: '重新登录', fix: 'login' },
          { label: auth.backup ? '更新备用 token' : '生成备用 token', fix: 'token' },
        ]
      : [],

  Login: ({ fix, onClose }) => fix === 'accounts' ? <ClaudeAccounts /> : <ClaudeLogin kind={fix as ClaudeLoginKind} onClose={onClose} />,

  // claude-opus-5-5 → Opus 5.5
  modelName(model) {
    const match = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(model)
    if (!match) {
      return model
    }
    const [, family, major, minor] = match
    return `${family[0].toUpperCase()}${family.slice(1)} ${minor ? `${major}.${minor}` : major}`
  },
}
