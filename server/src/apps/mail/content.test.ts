import { describe, expect, it } from 'vitest'
import { parseMessage, parseSummary, renderMessage } from './content.js'
import type { MailMessage } from './types.js'

const message = { id: 'a1', threadId: 'b1', labelIds: ['INBOX', 'UNREAD'], internalDate: '1700000000000' }
const raw = Buffer.from([
  'From: =?UTF-8?B?5byg5LiJ?= <sender@example.test>',
  'To: owner@example.test',
  'Subject: =?UTF-8?B?5a6M5pW06YKu5Lu2?=',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="outer"', '',
  '--outer', 'Content-Type: multipart/related; boundary="related"', '',
  '--related', 'Content-Type: multipart/alternative; boundary="alternative"', '',
  '--alternative', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', Buffer.from('完整邮件\n第二行').toString('base64'),
  '--alternative', 'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: quoted-printable', '', '<html><head><style>.banner { color: red; }</style></head><body><table><tr><td class="banner">Complete email</td></tr></table><img src="cid:logo@example.test"></body></html>',
  '--alternative--', '--related', 'Content-Type: image/png', 'Content-ID: <logo@example.test>', 'Content-Disposition: inline; filename="logo.png"', 'Content-Transfer-Encoding: base64', '', 'iVBORw0KGgo=',
  '--related--', '--outer', 'Content-Type: application/pdf', 'Content-Disposition: attachment; filename="contract.pdf"', 'Content-Transfer-Encoding: base64', '', Buffer.from('%PDF-1.4\nfixture').toString('base64'), '--outer--', '',
].join('\r\n'))

describe('邮件内容', () => {
  it('列表元数据也解码 MIME 编码的主题和发件人', async () => {
    const result = await parseSummary({ ...message, payload: { headers: [
      { name: 'Subject', value: '=?UTF-8?B?5a6M5pW06YKu5Lu2?=' },
      { name: 'From', value: '=?UTF-8?B?5byg5LiJ?= <sender@example.test>' },
    ] } })
    expect(result.subject).toBe('完整邮件')
    expect(result.from).toContain('张三')
  })

  it('解析嵌套 MIME、中文邮件头、两种正文、内嵌图片和二进制附件', async () => {
    const { detail, attachments } = await parseMessage(message, raw)
    expect(detail.subject).toBe('完整邮件')
    expect(detail.from).toContain('张三')
    expect(detail.text).toBe('完整邮件\n第二行')
    expect(detail.html).toContain('<table>')
    expect(detail.attachments).toEqual([
      expect.objectContaining({ name: 'logo.png', type: 'image/png', cid: 'logo@example.test' }),
      expect.objectContaining({ name: 'contract.pdf', type: 'application/pdf' }),
    ])
    expect(attachments[1].content.toString()).toBe('%PDF-1.4\nfixture')
    const html = renderMessage(detail, (id) => attachments[id].content)
    expect(html).toContain('data:image/png;base64,iVBORw0KGgo=')
    expect(html).toContain('.banner { color: red; }')
    expect(html).toContain('<table>')
    detail.html = '<style>.banner{background-image:url(cid:logo@example.test)}</style><table background="cid:logo@example.test"><tr><td>Background</td></tr></table>'
    const background = renderMessage(detail, (id) => attachments[id].content)
    expect(background).not.toContain('cid:')
    expect(background.match(/data:image\/png;base64,/g)).toHaveLength(2)
  })

  it('保留超过 100 KB 的正文结尾并正确解码非 UTF-8 字符', async () => {
    const content = 'x'.repeat(150_000) + 'BODY-END'
    const parsed = await parseMessage(message, Buffer.from(`Content-Type: text/html; charset=utf-8\r\n\r\n<p>${content}</p>`))
    expect(parsed.detail.html).toContain('BODY-END</p>')
    const latin = await parseMessage(message, Buffer.from('Content-Type: text/plain; charset=iso-8859-1\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\ncaf=E9'))
    expect(latin.detail.text).toBe('café')
  })

  it('隔离脚本、表单、嵌套页面、跳转及危险资源，保留正常链接和图片', async () => {
    const { detail } = await parseMessage(message, raw)
    detail.html = `<script>parent.document.body.remove()</script><meta http-equiv="refresh" content="0;url=https://evil.test"><base href="https://evil.test"><iframe src="https://evil.test"></iframe><form action="/api/apps/mail/account"><input name="x"></form><img src="/api/apps/mail/oauth/callback" onerror="alert(1)"><img src="https://images.example.test/image.png"><a href="javascript:alert(1)">bad</a><a href="https://example.test">good</a><object data="data:text/html,evil"></object>`
    const html = renderMessage(detail, () => Buffer.alloc(0))
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('<object')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('/api/apps/mail')
    expect(html).not.toContain('http-equiv="refresh"')
    expect(html).toContain('https://images.example.test/image.png')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain("script-src 'none'")
  })

  it('纯文本被转义并保留换行，不执行其中的 HTML', async () => {
    const parsed = await parseMessage(message, Buffer.from('Content-Type: text/plain; charset=utf-8\r\n\r\n<script>alert(1)</script>\n第二行'))
    const html = renderMessage(parsed.detail, () => Buffer.alloc(0))
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('\n第二行')
    expect(html).not.toContain('<script>')
  })

  it('加密或无正文邮件明确显示提示', async () => {
    const parsed = await parseMessage(message, Buffer.from('Content-Type: application/pkcs7-mime\r\n\r\nencrypted'))
    expect(parsed.detail.warnings.some((warning) => warning.includes('加密'))).toBe(true)
    expect(renderMessage({ ...parsed.detail, html: '', text: '' } as MailMessage, () => Buffer.alloc(0))).toContain('<pre')
  })
})
