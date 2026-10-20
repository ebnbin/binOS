import { systemApi } from './system/api.js'
import { monitor } from './system/monitor.js'
import { filesApi } from './files/api.js'
import { codeApp } from './code/index.js'
import type { ServerApp } from './types.js'

export const serverApps: ServerApp[] = [codeApp, { id: 'files', api: filesApi }, { id: 'system', api: systemApi, start: () => monitor.start() }]
