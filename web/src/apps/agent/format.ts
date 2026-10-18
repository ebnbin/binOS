import { useEffect, useState } from 'react'

// 耗时：10 秒内精确到 0.1 秒
export function formatDuration(ms: number) {
  const seconds = ms / 1000
  if (seconds < 10) {
    return `${Math.max(seconds, 0.1).toFixed(1)} 秒`
  }
  if (seconds < 60) {
    return `${Math.floor(seconds)} 秒`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} 分 ${Math.floor(seconds % 60)} 秒`
  }
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`
}

export function formatTokens(count: number) {
  if (count < 1000) {
    return String(count)
  }
  if (count < 1_000_000) {
    return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)}k`
  }
  return `${(count / 1_000_000).toFixed(1)}M`
}

// claude-opus-5-5 → Opus 5.5
export function formatModel(model: string) {
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(model)
  if (!match) {
    return model
  }
  const [, family, major, minor] = match
  return `${family[0].toUpperCase()}${family.slice(1)} ${minor ? `${major}.${minor}` : major}`
}

// 正在计时时每秒更新一次的当前时间
export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) {
      return
    }
    const tick = () => setNow(Date.now())
    const first = window.setTimeout(tick)
    const timer = window.setInterval(tick, 1000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [active])
  return now
}
