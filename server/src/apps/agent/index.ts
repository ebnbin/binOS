import type { ServerApp } from '../types.js'
import { agentApi } from './api.js'
import { resumeTurns } from './turns.js'

export const agentApp: ServerApp = { id: 'agent', api: agentApi, start: resumeTurns }
