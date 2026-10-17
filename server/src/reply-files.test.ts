import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { attachReplyFiles } from './reply-files.js'

describe('attachReplyFiles', () => {
  it('引用的本机图片和网页存进 session，引用改成文件名；其他图片引用保持原样', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reply-files-'))
    const image = path.join(dir, 'a b.PNG')
    writeFileSync(image, 'png')
    const page = path.join(dir, 'page.htm')
    writeFileSync(page, '<p>hi</p>')
    const saved = new Map<string, Buffer>()
    const text = [
      `![截图](<${image}>)`,
      `![网页](${page})`,
      `![缺失](${path.join(dir, 'missing.png')})`,
      '![相对](shot.png)',
      '![网络](https://example.com/a.png)',
      `![文本](${path.join(dir, 'a.txt')})`,
    ].join('\n')

    const result = attachReplyFiles(text, (name, data) => saved.set(name, data)).split('\n')

    const [name, pageName] = saved.keys()
    expect(name).toMatch(/^[0-9a-f]{16}\.png$/)
    expect(saved.get(name)?.toString()).toBe('png')
    expect(pageName).toMatch(/^[0-9a-f]{16}\.html$/)
    expect(result.slice(0, 2)).toEqual([`![截图](${name})`, `![网页](${pageName})`])
    expect(result.slice(2)).toEqual(text.split('\n').slice(2))
  })
})
