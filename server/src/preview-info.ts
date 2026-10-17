import path from 'node:path'

// 由 scripts/preview.ts 写入，正式版据此把子域名的请求转给预览实例
export type PreviewInfo = {
  port: number
  commit: string
}

export function previewInfoPath(previewsDir: string, branch: string) {
  return path.join(previewsDir, branch, 'preview.json')
}

export function previewUrl(branch: string) {
  return `https://${branch}.binos.app`
}

// 分支名只用小写字母、数字和连字符，本身就是合法的一级子域名；Universal SSL 只覆盖一级
export function previewBranch(url: string): string | undefined {
  return /^([a-z0-9-]+)\.binos\.app$/.exec(new URL(url).hostname)?.[1]
}
