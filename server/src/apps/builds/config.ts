import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { appDir, codeDir, isTestInstance } from '../../paths.js'
import { repoDir } from '../code/repositories.js'
export const dataDir = appDir('builds')
export const socketPath = path.join(os.tmpdir(), `binos-builds-${createHash('sha256').update(dataDir).digest('hex').slice(0, 16)}.sock`)
export const lockPath = path.join(dataDir, 'manager.lock')
export const version = existsSync(path.join(codeDir, 'VERSION')) ? readFileSync(path.join(codeDir, 'VERSION'), 'utf8').trim() : 'dev'
export const mock = isTestInstance && process.env.BINOS_BUILDS_MODE !== 'real'
export const automatic = !isTestInstance
export const repository = process.env.BINOS_BUILDS_REPO ?? repoDir
export const resultsDir = path.join(dataDir, 'results')
export const workDir = path.join(dataDir, 'work')
export const statePath = path.join(dataDir, 'state.json')
