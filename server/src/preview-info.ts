import path from 'node:path'

// 由 scripts/preview.ts 写入，正式版据此把子域名的请求转给预览实例
export type PreviewInfo = {
  port: number
  commit: string
}

export function previewInfoPath(previewsDir: string, name: string) {
  return path.join(previewsDir, name, 'preview.json')
}

// name 是分支名，或者 pr-<编号>：后者是链接到分支预览目录的别名。
// 分支名只用小写字母、数字和连字符，本身就是合法的一级子域名；Universal SSL 只覆盖一级
export function previewUrl(name: string) {
  return `https://${name}.binos.app`
}

export function previewName(url: string): string | undefined {
  return /^([a-z0-9-]+)\.binos\.app$/.exec(new URL(url).hostname)?.[1]
}
