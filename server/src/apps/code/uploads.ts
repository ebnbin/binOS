import { randomBytes } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream } from 'node:stream/web'
import { dataDir, filesDir } from './sessions.js'
import { viewHint } from '../../services/agent/index.js'
import type { Provider } from '../../services/agent/types.js'
import type { Attachment } from './types.js'

// 用户上传的附件先放在 uploads/，随消息发出时移进 session 的 files/：新对话发出第一句之前还没有 session 目录

const uploadsDir = path.join(dataDir, 'uploads')

export const maxUploadBytes = 50 * 1024 * 1024
export const maxAttachments = 20

// 随机串加原来的扩展名，既是 uploads/ 下的文件名，也是移进 files/ 后的文件名
const filePattern = /^[0-9a-f]{32}(\.[a-z0-9]{1,10})?$/

export class UploadTooLarge extends Error {}

// 超过上限时中途放弃，不等整个文件传完
export async function saveUpload(body: ReadableStream<Uint8Array>, name: string): Promise<string> {
  const extension = path.extname(name).slice(1).toLowerCase()
  const file = randomBytes(16).toString('hex') + (/^[a-z0-9]{1,10}$/.test(extension) ? `.${extension}` : '')
  mkdirSync(uploadsDir, { recursive: true })
  const filePath = path.join(uploadsDir, file)
  let size = 0
  try {
    await pipeline(
      Readable.fromWeb(body),
      async function* (source: AsyncIterable<Buffer>) {
        for await (const chunk of source) {
          size += chunk.length
          if (size > maxUploadBytes) {
            throw new UploadTooLarge()
          }
          yield chunk
        }
      },
      createWriteStream(filePath),
    )
  } catch (error) {
    rmSync(filePath, { force: true })
    throw error
  }
  return file
}

// 文件名会写进给 agent 的消息和下载时的文件名，去掉控制字符
export function parseAttachments(input: unknown): Attachment[] | undefined {
  if (input === undefined) {
    return []
  }
  if (!Array.isArray(input) || input.length > maxAttachments) {
    return undefined
  }
  const attachments: Attachment[] = []
  for (const item of input as { file?: unknown; name?: unknown }[]) {
    const { file, name } = item ?? {}
    if (typeof file !== 'string' || !filePattern.test(file) || typeof name !== 'string' || !existsSync(path.join(uploadsDir, file))) {
      return undefined
    }
    attachments.push({ file, name: name.replace(/\p{Cc}/gu, '').slice(0, 200) || file })
  }
  return attachments
}

export function moveUploads(sessionId: number, attachments: Attachment[]) {
  if (attachments.length) {
    mkdirSync(filesDir(sessionId), { recursive: true })
  }
  for (const { file } of attachments) {
    renameSync(path.join(uploadsDir, file), path.join(filesDir(sessionId), file))
  }
}

// 撤回了排队的消息，它的附件不再用了
export function discardUploads(attachments: Attachment[]) {
  for (const { file } of attachments) {
    rmSync(path.join(uploadsDir, file), { force: true })
  }
}

// 附件不直接放进消息，写上存放的路径，让 agent 自己查看：什么文件都能这样传
export function promptWithAttachments(sessionId: number, text: string, attachments: Attachment[], provider: Provider): string {
  if (!attachments.length) {
    return text
  }
  const list = attachments.map(({ file, name }) => `- ${path.join(filesDir(sessionId), file)}（${name}）`).join('\n')
  return `${text.trim() ? `${text}\n\n` : ''}用户附上了文件，${viewHint(provider)}：\n${list}`
}
