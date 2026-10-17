import { closeSync, fstatSync, openSync, readSync } from 'node:fs'

// 读取一个不断增长的文件里新增的完整行。按字节读取，一行完整了才返回，避免把多字节字符或半行内容拆开
export class LineReader {
  private readonly path: string
  private offset = 0
  private pending = Buffer.alloc(0)

  constructor(path: string) {
    this.path = path
  }

  read(): string[] {
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
    const lines: string[] = []
    let newline
    while ((newline = this.pending.indexOf(10)) >= 0) {
      lines.push(this.pending.subarray(0, newline).toString('utf8'))
      this.pending = this.pending.subarray(newline + 1)
    }
    return lines
  }
}
