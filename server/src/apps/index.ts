import { kitaAppApi } from './kita/api.js'
import { devicesApi } from './devices/api.js'
import { terminalApi } from './terminal/api.js'
import { systemApi } from './system/api.js'
import { monitor } from './system/monitor.js'
import { filesApi } from './files/api.js'
import { codeApp } from './code/index.js'
import type { ServerApp } from './types.js'
import { musicApi } from './music/api.js'

export const serverApps: ServerApp[] = [
  { id: 'kita', api: kitaAppApi },
  { id: 'devices', api: devicesApi },
  codeApp,
  { id: 'terminal', api: terminalApi },
  { id: 'files', api: filesApi },
  { id: 'music', api: musicApi },
  { id: 'system', api: systemApi, start: () => monitor.start() },
]
