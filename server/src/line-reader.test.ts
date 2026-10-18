import { appendFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { LineReader } from './line-reader.js'

it('只返回完整的行，不拆开多字节字符', () => {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'binos-test-')), 'output.jsonl')
  writeFileSync(file, '')
  const reader = new LineReader(file)
  expect(reader.read()).toEqual([])

  const text = Buffer.from('第一行\n第二')
  appendFileSync(file, text.subarray(0, text.length - 1))
  expect(reader.read()).toEqual([{ text: '第一行', end: Buffer.byteLength('第一行\n') }])
  appendFileSync(file, Buffer.concat([text.subarray(text.length - 1), Buffer.from('行\n')]))
  expect(reader.read()).toEqual([{ text: '第二行', end: text.length + Buffer.byteLength('行\n') }])
  expect(reader.read()).toEqual([])
})
