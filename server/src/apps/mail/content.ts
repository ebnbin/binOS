import { simpleParser } from 'mailparser'
import sanitizeHtml from 'sanitize-html'
import type { GmailMessage, MailMessage, MailSummary } from './types.js'

export function summary(message: GmailMessage): MailSummary {
  const header = (name: string) => message.payload?.headers?.find((item) => item.name.toLowerCase() === name)?.value ?? ''
  return {
    id: message.id, threadId: message.threadId, subject: header('subject'), from: header('from'), to: header('to'),
    date: Number(message.internalDate) || Date.parse(header('date')) || 0, snippet: message.snippet ?? '', labels: message.labelIds ?? [],
  }
}

export async function parseSummary(message: GmailMessage): Promise<MailSummary> {
  const raw = (message.payload?.headers ?? []).map((item) => `${item.name.replace(/[\r\n:]/g, '')}: ${item.value.replace(/[\r\n]/g, ' ')}`).join('\r\n')
  const parsed = await simpleParser(Buffer.from(`${raw}\r\n\r\n`), { skipHtmlToText: true, skipTextToHtml: true })
  const to = Array.isArray(parsed.to) ? parsed.to.map((item) => item.text).join(', ') : parsed.to?.text
  return { ...summary(message), subject: parsed.subject ?? '', from: parsed.from?.text ?? '', to: to ?? '' }
}

export async function parseMessage(message: GmailMessage, raw: Buffer) {
  const parsed = await simpleParser(raw, { skipImageLinks: true, skipHtmlToText: true, skipTextToHtml: true, maxHtmlLengthToParse: Infinity })
  const address = (value: typeof parsed.to) => Array.isArray(value) ? value.map((item) => item.text).join(', ') : value?.text ?? ''
  const warnings: string[] = []
  if (raw.includes(Buffer.from('application/pkcs7-mime')) || raw.includes(Buffer.from('multipart/encrypted'))) warnings.push('这封邮件包含加密内容，需要解密后阅读；可下载原始邮件。')
  const detail: MailMessage = {
    ...summary(message), subject: parsed.subject ?? '', from: address(parsed.from), to: address(parsed.to), cc: address(parsed.cc), bcc: address(parsed.bcc),
    replyTo: address(parsed.replyTo), text: parsed.text ?? '', html: parsed.html || '',
    attachments: parsed.attachments.map((item, id) => ({ id, name: item.filename || `附件 ${id + 1}`, type: item.contentType, size: item.size, cid: item.contentId?.replace(/^<|>$/g, '') })),
    warnings,
  }
  const inlineIds = new Set(detail.attachments.filter((item) => imageType(item.type)).map((item) => item.cid))
  if ([...detail.html.matchAll(/cid:([^\s"'<>)]+)/gi)].some((match) => !inlineIds.has(match[1]))) detail.warnings.push('部分内嵌资源缺失或格式暂不支持；原始邮件内容仍可下载。')
  if (/(?:\bsrc\s*=\s*["']?\s*http:\/\/|url\(\s*["']?http:\/\/)/i.test(detail.html)) detail.warnings.push('邮件包含 HTTP 资源，浏览器可能限制加载；HTTPS 图片可正常加载。')
  if (!detail.html && !detail.text) detail.warnings.push('这封邮件没有可显示的 HTML 或纯文本正文；请查看附件或下载原始邮件。')
  return { detail, attachments: parsed.attachments }
}

export const imageType = (type: string) => /^image\/(png|jpeg|gif|webp|avif|bmp|x-icon|svg\+xml)$/i.test(type)
export const previewType = (type: string) => imageType(type) || type === 'application/pdf'

export function renderMessage(message: MailMessage, attachment: (id: number) => Buffer): string {
  const cid = new Map(message.attachments.filter((item) => item.cid && imageType(item.type)).map((item) => [item.cid!, item]))
  const imageUrl = (url: string) => {
    if (/^cid:/i.test(url)) {
      let id = url.slice(4)
      try { id = decodeURIComponent(id) } catch { /* 原始 Content-ID 也可能包含百分号 */ }
      const item = cid.get(id.replace(/^<|>$/g, ''))
      return item ? `data:${item.type};base64,${attachment(item.id).toString('base64')}` : ''
    }
    return /^https?:\/\//i.test(url) || /^data:image\/(png|jpeg|gif|webp|avif|bmp|svg\+xml|x-icon);base64,/i.test(url) ? url : ''
  }
  const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  const body = message.html || `<pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(message.text)}</pre>`
  const prepared = body.replace(/cid:([^\s"'<>)]+)/gi, (url) => imageUrl(url) || url)
  const html = sanitizeHtml(prepared, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'html', 'head', 'body', 'style', 'img', 'font', 'center', 'picture', 'hr'],
    allowedAttributes: {
      '*': ['style', 'class', 'id', 'dir', 'lang', 'align', 'valign', 'width', 'height', 'bgcolor', 'title', 'role'],
      a: ['href', 'target', 'rel', 'name'], img: ['src', 'alt', 'width', 'height'],
      font: ['color', 'size', 'face'], table: ['cellpadding', 'cellspacing', 'border', 'background'],
      td: ['colspan', 'rowspan', 'background'], th: ['colspan', 'rowspan', 'scope'],
    },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'], allowedSchemesByTag: { img: ['https', 'http', 'data'], table: ['https', 'http', 'data'], td: ['https', 'http', 'data'], th: ['https', 'http', 'data'] },
    allowProtocolRelative: false, allowVulnerableTags: true, parseStyleAttributes: false,
    transformTags: {
      a: (_tag, attrs) => ({ tagName: 'a', attribs: { ...attrs, href: /^(https?:\/\/|mailto:|tel:)/i.test(attrs.href ?? '') ? attrs.href : '', target: '_blank', rel: 'noopener noreferrer' } }),
      img: (_tag, attrs) => ({ tagName: 'img', attribs: { ...attrs, src: imageUrl(attrs.src ?? '') } }),
    },
  })
  const csp = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src https: http: data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html{color-scheme:light;background:white;color:#222}body{margin:16px;font:15px/1.6 -apple-system,BlinkMacSystemFont,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}pre{white-space:pre-wrap}</style></head><body>${html}</body></html>`
}
