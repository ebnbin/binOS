import type { PreviewFile } from '../preview/index.ts'
import { sessionFileUrl } from './api.ts'

export function threadPreviewFile(thread: string, file: string, name: string, path?: string): PreviewFile {
  const url = sessionFileUrl(thread, file)
  return { name, url, downloadUrl: sessionFileUrl(thread, file, name), infoUrl: url + '?info=1', source: '会话文件', path }
}
