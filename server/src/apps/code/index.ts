import type { ServerApp } from '../types.js'
import { codeApi } from './api.js'
import { resumeTurns } from './turns.js'

export const codeApp: ServerApp = { id: 'code', api: codeApi, start: resumeTurns }
