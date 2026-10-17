import type { ContentBlock, EntryFields, ImageBlock, TextBlock } from './types.js'

// 进展里的工具输出只推送开头一段，完整内容在这一轮结束后写进 transcript
const progressOutputLimit = 4000
const imageExtensions: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export type ClaudeResult = { is_error?: boolean; result?: string }

// 把 claude --output-format stream-json 的输出逐行转成 transcript 条目和这一轮的进展
export class ClaudeOutput {
  readonly entries: EntryFields[] = []
  partial = ''
  result: ClaudeResult | undefined
  private startingTool: { id: string; name: string } | undefined
  private readonly saveFile: (name: string, data: Buffer) => void

  constructor(saveFile: (name: string, data: Buffer) => void) {
    this.saveFile = saveFile
  }

  // 返回这一轮的进展是否有变化
  push(line: string): boolean {
    let data
    try {
      data = JSON.parse(line)
    } catch {
      return false
    }
    // 子任务的输出不算在这一轮的回答里
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

  // 图片按工具调用和位置命名：后端重启后重新读取同一份输出时，覆盖同一个文件
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
