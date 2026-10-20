import { useEffect, useState } from 'react'

const day = 86_400_000

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

// 登录要留意的事：一句话和程度（bad 是用不了了，warn 是还能用但要处理）；action 是按钮上的字，fix 交给这个 agent 的登录组件，说明做哪种登录
export type Attention = { text: string; tone: 'bad' | 'warn'; action: string; fix: string }

// 系统 app 里账号下面登录相关的一行；expired：已经用不了，标红
export type AuthRow = { label: string; value: string; note?: string; expired?: boolean }

// 能做的登录：按钮上的字和交给登录组件的 fix
export type LoginAction = { label: string; fix: string }
