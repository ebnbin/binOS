import type { Limits, QuotaWindow } from '@binos/server/services/agent/types'

const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export function formatReset(resetsAt: number) {
  const minutes = Math.round((resetsAt * 1000 - Date.now()) / 60_000)
  if (minutes <= 0) {
    return '已重置'
  }
  if (minutes < 60) {
    return `${minutes} 分钟后重置`
  }
  if (minutes < 24 * 60) {
    return `${Math.round(minutes / 60)} 小时后重置`
  }
  return `${weekday.format(new Date(resetsAt * 1000))} 重置`
}

// 过了重置时间，报告的用量就不作数了
export const current = (window: QuotaWindow | undefined) => (window && window.resetsAt * 1000 > Date.now() ? window.utilization : 0)

export function level(utilization: number, limited: boolean) {
  return limited || utilization >= 0.95 ? 'danger' : utilization >= 0.8 ? 'warning' : undefined
}

export function windowsOf(limits: Limits) {
  return [
    { name: '5 小时', window: limits.fiveHour },
    { name: '7 天', window: limits.sevenDay },
  ].filter((item): item is { name: string; window: QuotaWindow } => item.window !== undefined)
}
