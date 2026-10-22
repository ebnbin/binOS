export type IosRuntime = {
  identifier: string
  version: string
  isAvailable: boolean
  supportedDeviceTypes?: { identifier: string; productFamily: string }[]
}
export function iosProfile(runtimes: IosRuntime[], deviceType?: string, runtimeId?: string) {
  const available = runtimes.filter((runtime) => runtime.isAvailable && runtime.identifier.startsWith('com.apple.CoreSimulator.SimRuntime.iOS-') && (!runtimeId || runtime.identifier === runtimeId))
    .sort((a, b) => {
      const left = a.version.split('.').map(Number), right = b.version.split('.').map(Number)
      for (let i = 0; i < Math.max(left.length, right.length); i++) {
        const difference = (right[i] ?? 0) - (left[i] ?? 0)
        if (difference) return difference
      }
      return 0
    })
  const preferred = deviceType ?? 'com.apple.CoreSimulator.SimDeviceType.iPhone-18-Pro'
  for (const runtime of available) {
    if (runtime.supportedDeviceTypes?.some((device) => device.identifier === preferred)) return { runtime: runtime.identifier, deviceType: preferred }
  }
  if (!deviceType) {
    for (const runtime of available) {
      const phone = runtime.supportedDeviceTypes?.find((device) => device.productFamily === 'iPhone')
      if (phone) return { runtime: runtime.identifier, deviceType: phone.identifier }
    }
  }
  throw new Error(`没有可用的兼容 iOS runtime 与机型组合${runtimeId ? `：${runtimeId}` : ''}${deviceType ? ` / ${deviceType}` : ''}`)
}
