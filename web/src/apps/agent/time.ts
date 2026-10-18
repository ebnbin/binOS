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
