export type PreviewFile = {
  name: string
  url: string
  downloadUrl?: string
  // 返回 { size: number, modified: ISO 日期字符串, type: MIME 类型 } 的 JSON 接口。
  infoUrl?: string
  source?: string
  path?: string
}
