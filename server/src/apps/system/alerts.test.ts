import { expect, it } from 'vitest'
import { AlertTracker, conditions, defaultThresholds, parseThresholds } from './alerts.js'
import { snapshot } from '../../../test-fixtures/system.js'

it('内存分配率高但压力正常时不误报，周期性 deploy 空闲不误报', () => {
  expect(conditions(snapshot(), defaultThresholds)).toEqual([])
})
it('告警必须持续达到阈值，瞬时恢复清除候选；恢复和复发分开记录', () => {
  const tracker = new AlertTracker()
  const condition = { key: 'cpu', title: 'CPU', detail: 'high', severity: 'warning' as const, delay: 60000 }
  tracker.update([condition], 1000)
  tracker.update([], 5000)
  tracker.update([condition], 10000)
  tracker.update([condition], 60999)
  expect(tracker.alerts).toHaveLength(0)
  tracker.update([condition], 70000)
  expect(tracker.alerts).toHaveLength(1)
  const id = tracker.alerts[0].id
  tracker.acknowledge(id, 71000)
  tracker.update([condition], 72000)
  expect(tracker.alerts[0].acknowledged).toBe(71000)
  tracker.update([], 80000)
  expect(tracker.alerts[0].resolved).toBe(80000)
  tracker.update([{ ...condition, delay: 0 }], 90000)
  expect(tracker.alerts).toHaveLength(2)
  expect(tracker.alerts[0].id).not.toBe(id)
  tracker.acknowledge(tracker.alerts[0].id, 90500)
  tracker.update([{ ...condition, severity: 'critical', delay: 0 }], 91000)
  expect(tracker.alerts[0].acknowledged).toBeUndefined()
})
it('APFS 共享容量告警去重，严重压力、热限制、低电和服务退出正确分级', () => {
  const data = snapshot()
  data.volumes[0].available = 1024 ** 3
  data.volumes.push({ ...data.volumes[0], mount: '/System/Volumes/Data' })
  data.memory.pressure = 'critical'
  data.power = { source: 'Battery Power', battery: 5, charging: '', thermalWarning: true }
  data.services.push({ id: 'tunnel', label: 'app.binos.tunnel', state: 'not running', periodic: false })
  const alerts = conditions(data, defaultThresholds)
  expect(alerts.filter((a) => a.key.startsWith('disk:'))).toHaveLength(1)
  for (const key of ['memory', 'battery', 'thermal', 'service:tunnel']) expect(alerts.find((a) => a.key === key)?.severity).toBe('critical')
  data.runtime.test = true
  expect(conditions(data, defaultThresholds).some((a) => a.key.startsWith('service:'))).toBe(false)
})
it('备份不可确认与 SMART 失败分别提示，正常 SMART 不误报', () => {
  const data = snapshot()
  data.probes = [
    { id: 'backup', label: 'backup', at: data.at, error: 'unavailable' },
    { id: 'smart', label: 'SMART', at: data.at, text: 'SMART Status: Verified' },
  ]
  expect(conditions(data, defaultThresholds).map((a) => a.key)).toEqual(['backup'])
  data.probes[1].text = 'SMART Status: Failing'
  expect(conditions(data, defaultThresholds).find((a) => a.key === 'smart')?.severity).toBe('critical')
})
it('拒绝字符串、非有限值和越界阈值', () => {
  expect(parseThresholds(defaultThresholds)).toEqual(defaultThresholds)
  for (const value of ['90', NaN, Infinity, 101, 0]) expect(() => parseThresholds({ ...defaultThresholds, cpu: value })).toThrow('cpu 必须在 10–100 之间')
})
