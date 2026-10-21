import { mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { snapshotFiles } from './files.js'

describe('snapshotFiles', () => {
  it('保存本机文件链接和图片引用，跳过网络和缺失文件；文件变了才存新副本', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'agent-files-'))
    const files = path.join(dir, 'files')
    const image = path.join(dir, 'a b.PNG')
    writeFileSync(image, 'png')
    const page = path.join(dir, 'page.htm')
    writeFileSync(page, '<p>hi</p>')
    const binary = path.join(dir, 'archive.zip')
    const noExtension = path.join(dir, 'LICENSE')
    writeFileSync(binary, new Uint8Array([0, 255, 128]))
    writeFileSync(noExtension, 'license')
    const text = [
      `[压缩包](${binary})`,
      `[许可证](${noExtension})`,
      `[目录](${dir})`,
      `![截图](<${image}>)`,
      `![转义](${encodeURI(image)})`,
      `![网页](${page})`,
      `![缺失](${path.join(dir, 'missing.png')})`,
      '![相对](shot.png)',
      '![网络](https://example.com/a.png)',
      `![文本](${path.join(dir, 'a.txt')})`,
    ].join('\n')

    const saved = snapshotFiles(text, files)
    expect(Object.keys(saved)).toEqual([binary, noExtension, image, page])
    expect(readFileSync(path.join(files, saved[binary]))).toEqual(Buffer.from([0, 255, 128]))
    expect(saved[noExtension]).toMatch(/^[0-9a-f]{32}$/)
    expect(saved[image]).toMatch(/^[0-9a-f]{32}\.png$/)
    expect(readFileSync(path.join(files, saved[image]), 'utf8')).toBe('png')
    expect(saved[page]).toMatch(/\.htm$/)
    expect(snapshotFiles(text, files)).toEqual(saved)
    expect(snapshotFiles(text, files, saved)).toEqual({})

    utimesSync(image, new Date(), new Date(Date.now() + 10_000))
    expect(snapshotFiles(text, files)[image]).not.toBe(saved[image])
  })
})
