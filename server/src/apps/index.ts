import { filesApi } from './files/api.js'
import { codeApp } from './code/index.js'
import type { ServerApp } from './types.js'

export const serverApps: ServerApp[] = [codeApp, { id: 'files', api: filesApi }]
