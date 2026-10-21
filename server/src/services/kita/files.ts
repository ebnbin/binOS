import { createHash } from 'node:crypto'
import { constants, copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { drivers } from './drivers/index.js'
import { filesDir } from './store.js'
import type { AgentId, Attachment } from './types.js'

// Markdown links and images share the same saved-file lifecycle.
const filePattern = /!?\[[^\]\n]*\]\((?:<([^>\n]+)>|([^)\s]+))\)/g

// 路径里可能有转义（空格写成 %20），按还原后的路径找文件；页面上也按还原后的路径找快照
export function decodeReference(reference: string): string {
  try {
    return decodeURI(reference)
  } catch {
    return reference
  }
}

// 给文字里引用的本机文件存快照，返回 known 里还没有的（路径 → 快照文件名）。文字本身不改。
// 原文件之后可能被覆盖或删掉，存一份才能让已发出的回复保持原样。快照名由路径、修改时间和大小决定：
// 文件没变就是同一个名字，后端重启后重读输出时不会重复存。用克隆复制，APFS 上不占额外空间
export function snapshotFiles(text: string, dir: string, known: Record<string, string> = {}): Record<string, string> {
  const saved: Record<string, string> = {}
  for (const match of text.matchAll(filePattern)) {
    const reference = decodeReference(match[1] ?? match[2])
    const extension = path.extname(reference).slice(1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32)
    if (known[reference] || saved[reference] || !path.isAbsolute(reference)) {
      continue
    }
    try {
      const info = statSync(reference)
      if (!info.isFile()) {
        continue
      }
      const hash = createHash('sha256').update(`${reference}\0${info.mtimeMs}\0${info.size}`).digest('hex')
      const name = `${hash.slice(0, 32)}${extension ? `.${extension}` : ''}`
      if (!existsSync(path.join(dir, name))) {
        mkdirSync(dir, { recursive: true })
        copyFileSync(reference, path.join(dir, name), constants.COPYFILE_FICLONE)
      }
      saved[reference] = name
    } catch {
      // 文件不存在或读不了，页面上显示成无法显示
    }
  }
  return saved
}

// 用户附上的本机文件复制进 session 的 files/，文件名不变。原文件等消息交给 agent 之后再删，交不过去时还能再发
export function copyAttachments(sessionId: string, files: { path: string; name: string }[]): Attachment[] {
  if (files.length > 0) {
    mkdirSync(filesDir(sessionId), { recursive: true })
  }
  return files.map(({ path: from, name }) => {
    const file = path.basename(from)
    copyFileSync(from, path.join(filesDir(sessionId), file), constants.COPYFILE_FICLONE)
    return { file, name }
  })
}

// 附件不直接放进消息，写上存放的路径，让 agent 自己查看：什么文件都能这样传
export function promptWithAttachments(sessionId: string, agent: AgentId, text: string, attachments: Attachment[]): string {
  if (!attachments.length) {
    return text
  }
  const list = attachments.map(({ file, name }) => `- ${path.join(filesDir(sessionId), file)}（${name}）`).join('\n')
  return `${text.trim() ? `${text}\n\n` : ''}用户附上了文件，${drivers[agent].fileHint}：\n${list}`
}
