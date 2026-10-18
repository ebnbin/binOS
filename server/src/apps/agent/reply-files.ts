import { createHash } from 'node:crypto'
import { constants, copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'

const extensions: Record<string, string> = {
  '.png': 'png',
  '.jpg': 'jpg',
  '.jpeg': 'jpg',
  '.gif': 'gif',
  '.webp': 'webp',
  '.html': 'html',
  '.htm': 'html',
}
const maxSize = 20 * 1024 * 1024
// ![说明](/绝对路径) 或 ![说明](</带空格的路径>)
const imagePattern = /!\[[^\]\n]*\]\((?:<([^>\n]+)>|([^)\s]+))\)/g

export const replyFilesPrompt = [
  '用户在 binOS 的网页上看你的回复，回复按 Markdown（GFM）渲染。',
  '代码块标上语言会按语言高亮；公式用 KaTeX 渲染，行内写成 $…$，单独成段写成 $$…$$；mermaid 代码块会画成图，流程、结构、时序之类用图说明更清楚时可以用。',
  '要给用户看图片（比如截图）时，在回复正文里用 Markdown 图片语法引用本机图片文件的绝对路径，例如 ![首页截图](/tmp/home.png)。',
  '要给用户一个可交互的网页（比如小工具、交互图表、演示）时，写成单个 HTML 文件，用同样的语法引用，例如 ![计算器](/tmp/calc.html)，网页会嵌在回复里运行。',
  'HTML 必须自包含：本机的相对路径资源加载不到，样式和脚本写在文件里，或从 CDN 加载。网页运行在沙箱里，不能访问 binOS、cookie 和 localStorage，不能弹窗和提交表单。',
  '支持 png、jpg、gif、webp、html，单个文件不超过 20 MB。回复发出时文件会被复制保存，之后删除原文件不影响显示。',
].join('\n')

// 路径里可能有转义（空格写成 %20），按还原后的路径找文件；页面上也按还原后的路径找快照
export function decodeReference(reference: string): string {
  try {
    return decodeURI(reference)
  } catch {
    return reference
  }
}

// 给文字里引用的本机图片和网页存快照，返回 known 里还没有的（路径 → 快照文件名）。文字本身不改。
// 原文件之后可能被覆盖或删掉，存一份才能让已发出的回复保持原样。快照名由路径、修改时间和大小决定：
// 文件没变就是同一个名字，后端重启后重读输出时不会重复存。用克隆复制，APFS 上不占额外空间
export function snapshotFiles(text: string, dir: string, known: Record<string, string> = {}): Record<string, string> {
  const saved: Record<string, string> = {}
  for (const match of text.matchAll(imagePattern)) {
    const reference = decodeReference(match[1] ?? match[2])
    const extension = extensions[path.extname(reference).toLowerCase()]
    if (known[reference] || saved[reference] || !extension || !path.isAbsolute(reference)) {
      continue
    }
    try {
      const info = statSync(reference)
      if (!info.isFile() || info.size > maxSize) {
        continue
      }
      const hash = createHash('sha256').update(`${reference}\0${info.mtimeMs}\0${info.size}`).digest('hex')
      const name = `${hash.slice(0, 32)}.${extension}`
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
