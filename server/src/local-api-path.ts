import { createHash } from 'node:crypto'
import path from 'node:path'

// macOS 的 Unix socket 路径最多 103 字节，实例根目录可能超过这个长度。
export function localApiSocketPath(root: string): string {
  const instance = createHash('sha256').update(path.resolve(root)).digest('hex').slice(0, 24)
  return path.join('/tmp', `binos-api-${process.getuid!()}`, `${instance}.sock`)
}
