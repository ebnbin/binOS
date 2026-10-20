import { expect, it } from 'vitest'
import { cpuUsage, parseNetwork, parseVm, parseVolumes } from './parsers.js'

it('CPU 首次采样与计数回退返回未知，后续按时间差计算', () => {
  expect(cpuUsage(undefined, { idle: 50, total: 100 })).toBeNull()
  expect(cpuUsage({ idle: 50, total: 100 }, { idle: 70, total: 200 })).toBe(80)
  expect(cpuUsage({ idle: 50, total: 100 }, { idle: 20, total: 50 })).toBeNull()
})
it('按实际 VM 页大小计算缓存、wired、压缩内存，保留未知值', () => {
  expect(parseVm('page size of 16384 bytes\nFile-backed pages: 3.\nPages wired down: 2.\nPages occupied by compressor: 4.')).toEqual({
    cached: 49152,
    wired: 32768,
    compressed: 65536,
  })
  expect(parseVm('page size of 4096 bytes')).toEqual({ cached: null, wired: null, compressed: null })
  expect(() => parseVm('invalid')).toThrow('无法识别 vm_stat 页大小')
})
it('网络只统计 Link 行，不重复累加 IPv4、IPv6；兼容无 MAC 地址行', () => {
  const text =
    'Name Mtu Network Address Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll\nen0 1500 <Link#1> aa:bb 10 2 1000 20 3 2000 0\nen0 1500 192.168 192.168.1.1 10 - 1000 20 - 2000 -\nutun0 1400 <Link#2> 5 0 500 6 0 600 0'
  expect(parseNetwork(text)).toEqual({ en0: { received: 1000, sent: 2000, errors: 5 }, utun0: { received: 500, sent: 600, errors: 0 } })
})
it('保留带空格的挂载点', () => {
  expect(parseVolumes('Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/disk1 1000 200 700 23% /Volumes/External Drive')[0]).toMatchObject({
    mount: '/Volumes/External Drive',
    total: 1024000,
    available: 716800,
  })
})
