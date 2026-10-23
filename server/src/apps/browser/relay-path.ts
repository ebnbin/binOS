import { homedir } from 'node:os'
import path from 'node:path'

export function relayDir() {
  return process.env.BINOS_BROWSER_RELAY_DIR ?? path.join(homedir(), 'Library', 'Application Support', 'binOS', 'browser')
}
