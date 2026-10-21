import { terminalApi } from './terminal/api.js'
import { systemApi } from './system/api.js'
import { monitor } from './system/monitor.js'
import { filesApi } from './files/api.js'
import { codeApp } from './code/index.js'
import type { ServerApp } from './types.js'
import { musicApi } from './music/api.js'

export const serverApps: ServerApp[] = [
  codeApp,
  { id: 'terminal', api: terminalApi },
  { id: 'files', api: filesApi },
  { id: 'music', api: musicApi },
  { id: 'system', api: systemApi, start: () => monitor.start() },
]
