import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { attachReplyImages } from './reply-images.js'

describe('attachReplyImages', () => {
  it('引用的本机图片存进 session，引用改成文件名；其他图片引用保持原样', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reply-images-'))
    const image = path.join(dir, 'a b.PNG')
    writeFileSync(image, 'png')
    const saved = new Map<string, Buffer>()
    const text = [
      `![截图](<${image}>)`,
      `![缺失](${path.join(dir, 'missing.png')})`,
      '![相对](shot.png)',
      '![网络](https://example.com/a.png)',
      `![文本](${path.join(dir, 'a.txt')})`,
    ].join('\n')

    const result = attachReplyImages(text, (name, data) => saved.set(name, data)).split('\n')

    const [name] = saved.keys()
    expect(name).toMatch(/^[0-9a-f]{16}\.png$/)
    expect(saved.get(name)?.toString()).toBe('png')
    expect(result[0]).toBe(`![截图](${name})`)
    expect(result.slice(1)).toEqual(text.split('\n').slice(1))
  })
})
