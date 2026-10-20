import { randomUUID } from 'node:crypto'
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { sessionDir } from './sessions.js'
import type { QueuedMessage } from './types.js'

// 排队的消息：回答进行中，用户要等这一轮答完再说的话。存在 session 的 queue.json，先排的在前，发出就删掉；
// 页面关了、后端重启了也照样发出。附件留在 uploads/，发出时才移进 session 的 files/
const queuePath = (id: number) => path.join(sessionDir(id), 'queue.json')

export function readQueue(id: number): QueuedMessage[] {
  try {
    return JSON.parse(readFileSync(queuePath(id), 'utf8'))
  } catch {
    return []
  }
}

function writeQueue(id: number, queue: QueuedMessage[]) {
  if (queue.length === 0) {
    rmSync(queuePath(id), { force: true })
    return
  }
  writeFileSync(`${queuePath(id)}.tmp`, JSON.stringify(queue, null, 2) + '\n')
  renameSync(`${queuePath(id)}.tmp`, queuePath(id))
}

export function pushQueue(id: number, message: Omit<QueuedMessage, 'id'>) {
  writeQueue(id, [...readQueue(id), { id: randomUUID(), ...message }])
}

// 取出来却没发出去时放回最前面
export function unshiftQueue(id: number, message: QueuedMessage) {
  writeQueue(id, [message, ...readQueue(id)])
}

// 取出一条，不给 itemId 就是最前面那条；没有时返回 undefined
export function takeQueue(id: number, itemId?: string): QueuedMessage | undefined {
  const queue = readQueue(id)
  const index = itemId === undefined ? 0 : queue.findIndex((item) => item.id === itemId)
  if (index < 0 || index >= queue.length) {
    return undefined
  }
  const [message] = queue.splice(index, 1)
  writeQueue(id, queue)
  return message
}
