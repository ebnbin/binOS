import { closeSync, fstatSync, openSync, readSync } from 'node:fs'

// 按字节读取，一行完整了才解码，避免拆开多字节字符。end 是这一行（含换行）在文件里的结束位置
export class LineReader {
  private readonly path: string
  private offset = 0
  private pending = Buffer.alloc(0)
  private consumed = 0

  constructor(path: string) {
    this.path = path
  }

  read(): { text: string; end: number }[] {
    const fd = openSync(this.path, 'r')
    try {
      const size = fstatSync(fd).size
      if (size <= this.offset) {
        return []
      }
      const chunk = Buffer.alloc(size - this.offset)
      readSync(fd, chunk, 0, chunk.length, this.offset)
      this.offset = size
      this.pending = Buffer.concat([this.pending, chunk])
    } finally {
      closeSync(fd)
    }
    const lines: { text: string; end: number }[] = []
    let newline
    while ((newline = this.pending.indexOf(10)) >= 0) {
      this.consumed += newline + 1
      lines.push({ text: this.pending.subarray(0, newline).toString('utf8'), end: this.consumed })
      this.pending = this.pending.subarray(newline + 1)
    }
    return lines
  }
}
