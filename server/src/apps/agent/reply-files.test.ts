import { mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { snapshotFiles } from './reply-files.js'

describe('snapshotFiles', () => {
  it('引用的本机图片和网页存快照，其他引用不管；文件变了才存新快照', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reply-files-'))
    const files = path.join(dir, 'files')
    const image = path.join(dir, 'a b.PNG')
    writeFileSync(image, 'png')
    const page = path.join(dir, 'page.htm')
    writeFileSync(page, '<p>hi</p>')
    const text = [
      `![截图](<${image}>)`,
      `![转义](${encodeURI(image)})`,
      `![网页](${page})`,
      `![缺失](${path.join(dir, 'missing.png')})`,
      '![相对](shot.png)',
      '![网络](https://example.com/a.png)',
      `![文本](${path.join(dir, 'a.txt')})`,
    ].join('\n')

    const saved = snapshotFiles(text, files)
    expect(Object.keys(saved)).toEqual([image, page])
    expect(saved[image]).toMatch(/^[0-9a-f]{32}\.png$/)
    expect(readFileSync(path.join(files, saved[image]), 'utf8')).toBe('png')
    expect(saved[page]).toMatch(/\.html$/)
    expect(snapshotFiles(text, files)).toEqual(saved)
    expect(snapshotFiles(text, files, saved)).toEqual({})

    utimesSync(image, new Date(), new Date(Date.now() + 10_000))
    expect(snapshotFiles(text, files)[image]).not.toBe(saved[image])
  })
})
