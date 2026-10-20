import type { MonitorStatus } from '@binos/server/apps/system/types'
import { useSyncExternalStore } from 'react'

export const systemUrl = '/api/apps/system'
export async function systemRequest<T>(route: string, init?: RequestInit): Promise<T> {
  const response = await fetch(systemUrl + route, { ...init, signal: init?.signal || AbortSignal.timeout(12_000) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || `读取失败（${response.status}）`)
  return data as T
}

type State = { status?: MonitorStatus; error?: string; lastSuccess: number; now: number }
let state: State = { lastSuccess: 0, now: Date.now() }
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined
let pending: Promise<void> | undefined
let running = false
let generation = 0
let notifications = false
try {
  notifications = localStorage.getItem('binos.monitor.notifications') === 'true'
} catch {
  /* 存储不可用时，通知仅在当前页面保留。 */
}
const delivered = new Set<string>()

function notify(title: string, detail: string, key: string) {
  if (!notifications || !('Notification' in window) || Notification.permission !== 'granted' || delivered.has(key)) return
  delivered.add(key)
  try {
    new Notification(title, { body: detail, tag: key })
  } catch {
    /* 部分移动浏览器只支持由 Service Worker 发送通知。 */
  }
}
function emit() {
  state = { ...state }
  listeners.forEach((listener) => listener())
}
export function refreshMonitor() {
  if (pending) return pending
  pending = (async () => {
    try {
      const status = await systemRequest<MonitorStatus>('/status')
      state = { status, lastSuccess: Date.now(), now: Date.now() }
      delivered.delete('monitor-offline')
      const snapshot = status.snapshot
      if (snapshot && Date.now() - snapshot.at > 30_000) notify('宿主监控数据已过期', '采集可能已停止，请检查系统 App。', `stale:${snapshot.at}`)
      for (const alert of status.alerts) {
        if (!alert.acknowledged && (!alert.resolved || ((alert.key === 'boot' || alert.key === 'gap') && Date.now() - alert.updated < 120_000)))
          notify(alert.title, alert.detail, `${alert.id}:${alert.severity}`)
      }
    } catch (error) {
      state = { ...state, error: error instanceof Error ? error.message : String(error), now: Date.now() }
      if (Date.now() - state.lastSuccess > 30_000) notify('无法连接宿主监控', '可能是网络、登录或宿主异常；当前无法判断宿主状态。', 'monitor-offline')
    } finally {
      pending = undefined
      emit()
    }
  })()
  return pending
}
function onVisible() {
  if (document.visibilityState === 'visible') void refreshMonitor()
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!running) {
    running = true
    const current = ++generation
    const poll = async () => {
      await refreshMonitor()
      if (running && current === generation) timer = setTimeout(() => void poll(), 5000)
    }
    void poll()
    document.addEventListener('visibilitychange', onVisible)
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      running = false
      generation++
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }
}
export function useMonitor() {
  return useSyncExternalStore(subscribe, () => state)
}
export function notificationsEnabled() {
  return notifications
}
export async function enableNotifications() {
  if (!('Notification' in window)) throw new Error('此浏览器不支持桌面通知')
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('通知权限未开启，请检查浏览器设置')
  notifications = true
  try {
    localStorage.setItem('binos.monitor.notifications', 'true')
  } catch {
    /* 当前页面仍可接收通知。 */
  }
  emit()
}
export function disableNotifications() {
  notifications = false
  try {
    localStorage.setItem('binos.monitor.notifications', 'false')
  } catch {
    /* 当前页面已停止通知。 */
  }
  emit()
}
