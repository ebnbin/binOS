import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { notifyChange } from '../../events.js'
import { appDir } from '../../paths.js'
import type { QueueMutation, QueueSnapshot, Track } from './types.js'
import { MusicError } from './youtube.js'

const file = () => path.join(appDir('music'), 'queue.json')
const key = (track: Track) => JSON.stringify([track.ref.provider, track.ref.id])
type SavedQueue = QueueSnapshot & { operations: string[] }
function read(): SavedQueue {
  if (!existsSync(file())) return { revision: 0, tracks: [], operations: [] }
  return JSON.parse(readFileSync(file(), 'utf8')) as SavedQueue
}
export function readQueue(): QueueSnapshot {
  const { revision, tracks } = read()
  return { revision, tracks }
}
function validTrack(value: unknown): value is Track {
  if (!value || typeof value !== 'object') return false
  const t = value as Track
  return typeof t.title === 'string' && t.title.length <= 2000 && !!t.ref &&
    typeof t.ref.provider === 'string' && t.ref.provider.length > 0 && t.ref.provider.length <= 100 &&
    typeof t.ref.id === 'string' && t.ref.id.length > 0 && t.ref.id.length <= 500 &&
    Array.isArray(t.artists) && t.artists.length <= 100 && t.artists.every(a => typeof a === 'string' && a.length <= 2000) &&
    typeof t.externalUrl === 'string' && t.externalUrl.length <= 4000 && t.externalUrl.startsWith('https://') &&
    (t.artworkUrl === undefined || typeof t.artworkUrl === 'string' && t.artworkUrl.length <= 4000 && t.artworkUrl.startsWith('https://')) &&
    (t.durationMs === undefined || typeof t.durationMs === 'number' && Number.isFinite(t.durationMs) && t.durationMs > 0)
}
export function mutateQueue(value: unknown): QueueSnapshot {
  const mutation = value as QueueMutation | null
  const op = mutation?.operation
  if (!mutation || typeof mutation.id !== 'string' || !/^[\w-]{1,100}$/.test(mutation.id) || !op ||
    !['add', 'initialize', 'remove', 'clear'].includes(op.type) ||
    ((op.type === 'add' || op.type === 'initialize') && (!Array.isArray(op.tracks) || op.tracks.length > 500 || !op.tracks.every(validTrack))) ||
    (op.type === 'remove' && (!op.ref || typeof op.ref.provider !== 'string' || typeof op.ref.id !== 'string'))) {
    throw new MusicError('队列操作无效。', 'invalid-input')
  }
  const saved = read()
  if (saved.operations.includes(mutation.id)) return { revision: saved.revision, tracks: saved.tracks }
  let tracks = saved.tracks
  if (op.type === 'clear') tracks = []
  else if (op.type === 'remove') tracks = tracks.filter(t => t.ref.provider !== op.ref.provider || t.ref.id !== op.ref.id)
  else if (op.type === 'add' || saved.revision === 0) {
    const known = new Set(tracks.map(key))
    tracks = [...tracks]
    for (const track of op.tracks) if (!known.has(key(track)) && tracks.length < 500) { tracks.push(track); known.add(key(track)) }
  }
  const next: SavedQueue = { revision: saved.revision + 1, tracks, operations: [...saved.operations, mutation.id].slice(-1000) }
  mkdirSync(appDir('music'), { recursive: true })
  writeFileSync(`${file()}.tmp`, JSON.stringify(next) + '\n', { mode: 0o600 })
  renameSync(`${file()}.tmp`, file())
  notifyChange({ type: 'music' })
  return { revision: next.revision, tracks }
}
