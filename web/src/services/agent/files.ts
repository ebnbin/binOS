import type { PreviewFile } from '../preview/index.ts'
import { threadFileUrl } from './api.ts'

export function threadPreviewFile(thread: string, file: string, name: string, path?: string): PreviewFile {
  const url = threadFileUrl(thread, file)
  return { name, url, downloadUrl: threadFileUrl(thread, file, name), infoUrl: url + '?info=1', source: '会话文件', path }
}
