import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const extensions: Record<string, string> = { '.png': 'png', '.jpg': 'jpg', '.jpeg': 'jpg', '.gif': 'gif', '.webp': 'webp' }
const maxSize = 20 * 1024 * 1024
// ![说明](/绝对路径) 或 ![说明](</带空格的路径>)
const imagePattern = /!\[([^\]\n]*)\]\((<[^>\n]+>|[^)\s]+)\)/g

export const replyImagesPrompt = [
  '用户在 binOS 的网页上看你的回复，回复按 Markdown 渲染。',
  '要给用户看图片（比如截图）时，在回复正文里用 Markdown 图片语法引用本机图片文件的绝对路径，例如 ![首页截图](/tmp/home.png)。',
  '支持 png、jpg、gif、webp，单张不超过 20 MB。回复发出时图片会被复制保存，之后删除原文件不影响显示。',
].join('\n')

// 把回复里引用的本机图片存进 session，引用改成存下的文件名。文件名取内容的哈希：后端重启后重新读取同一份输出时，覆盖同一个文件
export function attachReplyImages(text: string, saveFile: (name: string, data: Buffer) => void): string {
  return text.replace(imagePattern, (match, alt: string, target: string) => {
    const file = target.startsWith('<') ? target.slice(1, -1) : target
    const extension = extensions[path.extname(file).toLowerCase()]
    if (!extension || !path.isAbsolute(file)) {
      return match
    }
    let data: Buffer
    try {
      if (statSync(file).size > maxSize) {
        return match
      }
      data = readFileSync(file)
    } catch {
      return match
    }
    const name = `${createHash('sha256').update(data).digest('hex').slice(0, 16)}.${extension}`
    saveFile(name, data)
    return `![${alt}](${name})`
  })
}
