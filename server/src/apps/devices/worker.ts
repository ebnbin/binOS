import { reset, message } from './platform.js'
import type { Device } from './types.js'

try {
  await reset(JSON.parse(process.argv[2]) as Device)
} catch (error) {
  console.error(message(error))
  process.exitCode = 1
}
