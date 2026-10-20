const clock = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const monthDay = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' })
const fullDate = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' })

export function formatTime(date: Date, now = new Date()) {
  const days = dayNumber(now) - dayNumber(date)
  if (days === 0) {
    return clock.format(date)
  }
  if (days === 1) {
    return '昨天'
  }
  return date.getFullYear() === now.getFullYear() ? monthDay.format(date) : fullDate.format(date)
}

function dayNumber(date: Date) {
  return Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000)
}

const fullDateTime = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

// 对话里的时间分隔线：今天只写时刻，往前带上日期
export function formatDivider(date: Date, now = new Date()) {
  const time = clock.format(date)
  const days = dayNumber(now) - dayNumber(date)
  if (days === 0) {
    return time
  }
  if (days === 1) {
    return `昨天 ${time}`
  }
  return `${date.getFullYear() === now.getFullYear() ? monthDay.format(date) : fullDate.format(date)} ${time}`
}

export function formatFull(date: Date) {
  return fullDateTime.format(date)
}

export function sameDay(a: Date, b: Date) {
  return dayNumber(a) === dayNumber(b)
}

export function formatClock(date: Date) {
  return clock.format(date)
}

// 会话列表的分组，按自然日算
export function dateGroup(date: Date, now = new Date()) {
  const days = dayNumber(now) - dayNumber(date)
  if (days <= 0) {
    return '今天'
  }
  if (days === 1) {
    return '昨天'
  }
  if (days < 7) {
    return '7 天内'
  }
  return days < 30 ? '30 天内' : '更早'
}

const dateTime = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

// 离现在多久：3 小时后、2 天前
function relative(date: Date, now: number) {
  const minutes = Math.round((date.getTime() - now) / 60_000)
  const amount = Math.abs(minutes)
  const text = amount < 60 ? `${amount} 分钟` : amount < 48 * 60 ? `${Math.round(amount / 60)} 小时` : `${Math.round(amount / 60 / 24)} 天`
  return minutes >= 0 ? `${text}后` : `${text}前`
}

// 某个时刻和离现在多久：10/26 08:00（3 天后）
export function formatMoment(iso: string, now = Date.now()) {
  const date = new Date(iso)
  return `${dateTime.format(date)}（${relative(date, now)}）`
}
