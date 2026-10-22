import { buildRequest } from './client.js'
import { parseRequest } from './protocol.js'
const [action, ...args] = process.argv.slice(2)
try {
  if (action === 'serve') await import('./daemon.js')
  else if (['status', 'poll', 'stop'].includes(action)) console.log(JSON.stringify(await buildRequest(parseRequest({ action })), null, 2))
  else if (action === 'enqueue') console.log(JSON.stringify(await buildRequest(parseRequest({ action, ref: args[0] ?? 'main', targets: (args[1] ?? 'android,ios-simulator').split(',') })), null, 2))
  else if (action === 'cancel' || action === 'retry') console.log(JSON.stringify(await buildRequest(parseRequest({ action, id: args[0] })), null, 2))
  else console.log('用法：binos builds status|poll|serve|stop\n  enqueue main|pr/<编号>|<完整提交> [android,ios-simulator,ios-adhoc]\n  cancel|retry <构建ID>')
} catch (e) { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1 }
