import type { DevicesSnapshot } from '@binos/server/apps/devices/api'
import type { LeaseResult, Platform } from '@binos/server/apps/devices/types'
const base = '/api/apps/devices'
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${base}${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? '设备操作失败')
  return result as T
}
export const readDevices = () => request<DevicesSnapshot>('')
export const discoverDevices = () => request<DevicesSnapshot>('/discover', {})
export const acquireDevices = (platforms: Platform[], reason: string, requestId: string = crypto.randomUUID()) => request<LeaseResult>('/leases', { platforms, reason, requestId })
export const releaseDevices = (id: string) => request(`/leases/${encodeURIComponent(id)}/release`, {})
export const cancelDevices = (requestId: string) => request('/queue/cancel', { requestId })
export const controlDevice = (id: string, operation: 'destroy') => request(`/${encodeURIComponent(id)}/control`, { operation })
export const captureDevice = (id: string) => request<{ image: string; mime: string; at: number }>(`/${encodeURIComponent(id)}/screenshot`)
