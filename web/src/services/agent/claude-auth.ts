import { claudeAuthKey } from '@binos/server/services/agent/types'
import type { ClaudeAuth } from '@binos/server/services/agent/types'
import { useEffect, useState } from 'react'
import { useStateValue } from '../../state.ts'

const day = 86_400_000
// 完整登录剩不到这么多天时提醒重新登录，备用 token 剩不到这么多天时提醒更新
const loginWarnDays = 7
const backupWarnDays = 30

export function useClaudeAuth(): ClaudeAuth | undefined {
  return (useStateValue(claudeAuthKey) as ClaudeAuth | null) ?? undefined
}

// 到期提醒按天算，现在的时间每小时更新一次就够
export function useHourlyNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 3600_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

// 还剩几天，不足一天按 0
export const daysLeft = (iso: string, now: number) => Math.max(Math.floor((Date.parse(iso) - now) / day), 0)

// 要留意的事：一句话和程度（bad 是用不了了，warn 是还能用但要处理）；没有时是 undefined。fix 是该做的登录
export function authAttention(auth: ClaudeAuth | undefined, now: number): { text: string; tone: 'bad' | 'warn'; fix: 'login' | 'token' } | undefined {
  if (!auth) {
    return undefined
  }
  if (auth.mode === 'none') {
    return { text: 'Claude 没有能用的登录', tone: 'bad', fix: 'login' }
  }
  if (auth.mode === 'token') {
    return { text: auth.login?.broken ? 'Claude 的登录失效了，正在用备用 token' : 'Claude 的登录过期了，正在用备用 token', tone: 'warn', fix: 'login' }
  }
  const loginExpiry = auth.login?.expiresAt
  if (loginExpiry && Date.parse(loginExpiry) - now < loginWarnDays * day) {
    const days = daysLeft(loginExpiry, now)
    return { text: `Claude 的登录${days === 0 ? '今天' : `还有 ${days} 天`}到期`, tone: 'warn', fix: 'login' }
  }
  const backupExpiry = auth.backup?.expiresAt
  if (backupExpiry && Date.parse(backupExpiry) - now < backupWarnDays * day) {
    return { text: `Claude 的备用 token 还有 ${daysLeft(backupExpiry, now)} 天到期`, tone: 'warn', fix: 'token' }
  }
  return undefined
}
