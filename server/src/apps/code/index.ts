import type { ServerApp } from '../types.js'
import { codeApi } from './api.js'
import { drainQueues } from './messages.js'

export const codeApp: ServerApp = { id: 'code', api: codeApi, start: drainQueues }
