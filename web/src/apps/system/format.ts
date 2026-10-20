export const bytes = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '未知'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  const exponent = Math.min(4, Math.max(0, Math.floor(Math.log(Math.max(1, value)) / Math.log(1024))))
  return `${(value / 1024 ** exponent).toFixed(exponent ? 1 : 0)} ${units[exponent]}`
}
export const moment = (value: number | undefined) => (value ? new Date(value).toLocaleString('zh-CN') : '未知')
export const hostTabs = [
  ['overview', '概况'],
  ['resources', 'CPU 与内存'],
  ['storage', '磁盘'],
  ['network', '网络'],
  ['processes', '进程'],
  ['power', '电源与休眠'],
  ['diagnostics', '安全与诊断'],
  ['alerts', '告警'],
]
