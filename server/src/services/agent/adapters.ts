import type { Adapter } from './adapter.js'
import { claude } from './claude/index.js'
import { codex } from './codex/index.js'
import type { Provider } from './types.js'

export const adapters: Record<Provider, Adapter> = { claude, codex }
