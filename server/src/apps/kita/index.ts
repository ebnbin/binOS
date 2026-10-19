import type { ServerApp } from '../types.js'
import { kitaApi } from './api.js'
import { resumeTurns } from './turns.js'

export const kitaApp: ServerApp = { id: 'kita', api: kitaApi, start: resumeTurns }
