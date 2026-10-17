import type { ContentBlock, EntryFields, ImageBlock, TextBlock } from './types.js'

// 进展里的工具输出只推送开头一段，完整内容在这一轮结束后写进 transcript
const progressOutputLimit = 4000
// Claude 支持的图片格式和保存时用的扩展名
const imageExtensions: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export type ClaudeResult = { is_error?: boolean; result?: string }

// 把 claude --output-format stream-json 的输出逐行转成 transcript 条目和这一轮的进展。
// 只处理主对话，子任务的输出不算在这一轮的回答里。工具结果里的图片交给 saveFile 存成文件
export class ClaudeOutput {
  // 已完成的条目，这一轮结束时按顺序写进 transcript
  readonly entries: EntryFields[] = []
  // 正在生成的文字
  partial = ''
  // 最后的 result 消息；出现它不代表结束，agent 有后台任务时会继续回答
  result: ClaudeResult | undefined
  // 刚开始、还没拿到参数的工具调用
  private startingTool: { id: string; name: string } | undefined
  private readonly saveFile: (name: string, data: Buffer) => void

  constructor(saveFile: (name: string, data: Buffer) => void) {
    this.saveFile = saveFile
  }

  // 处理一行输出，返回这一轮的进展是否有变化
  push(line: string): boolean {
    let data
    try {
      data = JSON.parse(line)
    } catch {
      return false
    }
    if (data.parent_tool_use_id) {
      return false
    }
    switch (data.type) {
      case 'stream_event':
        return this.handleStreamEvent(data.event)
      case 'assistant':
        for (const block of data.message.content) {
          if (block.type === 'text') {
            this.addEntry('assistant', { type: 'text', text: block.text })
            this.partial = ''
          } else if (block.type === 'tool_use') {
            const { id, name, input } = block
            this.addEntry('assistant', { type: 'tool_use', id, name, input })
            this.startingTool = undefined
          }
        }
        return true
      case 'user':
        for (const block of data.message.content) {
          if (block.type === 'tool_result') {
            this.addEntry('user', {
              type: 'tool_result',
              tool_use_id: block.tool_use_id,
              content: this.resultContent(block.tool_use_id, block.content),
              is_error: block.is_error,
            })
          }
        }
        return true
      case 'result':
        this.result = data
        return false
      default:
        return false
    }
  }

  // 这一轮到目前为止的进展：已完成的内容块，加上刚开始的工具调用和正在生成的文字
  progress(): ContentBlock[] {
    const blocks = this.entries.flatMap((entry) =>
      (entry.message!.content as ContentBlock[]).map((block): ContentBlock => {
        if (block.type !== 'tool_result') {
          return block
        }
        const content = block.content.map((part) =>
          part.type === 'text' ? { ...part, text: part.text.slice(0, progressOutputLimit) } : part,
        )
        return { ...block, content }
      }),
    )
    if (this.startingTool) {
      blocks.push({ type: 'tool_use', ...this.startingTool, input: {} })
    }
    if (this.partial) {
      blocks.push({ type: 'text', text: this.partial })
    }
    return blocks
  }

  private handleStreamEvent(event: { type: string; content_block?: { type: string; id: string; name: string }; delta?: { type: string; text: string } }): boolean {
    if (event.type === 'content_block_start' && event.content_block?.type === 'text') {
      this.partial = ''
      return false
    }
    if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
      this.startingTool = { id: event.content_block.id, name: event.content_block.name }
      return true
    }
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      this.partial += event.delta.text
      return true
    }
    return false
  }

  private addEntry(type: 'user' | 'assistant', block: ContentBlock) {
    this.entries.push({ type, message: { role: type, content: [block] } })
  }

  // 工具结果可能是文字，也可能是内容块数组。图片按工具调用和位置命名，重新读取同一份输出时覆盖同一个文件；
  // 其他类型的块只记下类型
  private resultContent(toolUseId: string, content: unknown): (TextBlock | ImageBlock)[] {
    if (typeof content === 'string') {
      return [{ type: 'text', text: content }]
    }
    if (!Array.isArray(content)) {
      return []
    }
    return content.map((block, index): TextBlock | ImageBlock => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text }
      }
      const extension = block.type === 'image' && block.source?.type === 'base64' && imageExtensions[block.source.media_type]
      if (!extension) {
        return { type: 'text', text: `[${block.type}]` }
      }
      const file = `${toolUseId}-${index}.${extension}`
      this.saveFile(file, Buffer.from(block.source.data, 'base64'))
      return { type: 'image', file }
    })
  }
}
