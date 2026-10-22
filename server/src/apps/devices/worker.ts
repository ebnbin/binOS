import { create, destroy, reset, health, message } from './platform.js'
import type { Device } from './types.js'

try {
  let input = ''
  for await (const chunk of process.stdin) { input += chunk.toString(); if (input.length > 64 * 1024) throw new Error('设备操作输入过大') }
  const { operation, device } = JSON.parse(input) as { operation: 'create' | 'reset' | 'destroy' | 'check'; device: Device }
  if (operation === 'create') console.log(JSON.stringify(await create(device)))
  else if (operation === 'destroy') await destroy(device)
  else if (operation === 'check') {
    try { await health(device) } catch { await reset(device) }
  }
  else await reset(device)
} catch (error) {
  console.error(message(error))
  process.exitCode = 1
}
