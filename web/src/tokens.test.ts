/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = import.meta.dirname

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? files(path) : [path]
  })
}

const sources = files(root).filter((path) => /\.(css|tsx?)$/.test(path) && !path.endsWith('.test.ts'))
const styles = sources.filter((path) => path.endsWith('.css') && !path.endsWith('tokens.css'))
const read = (path: string) => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// 变量来自 tokens.css、各文件自己声明的局部变量、代码里设置的变量，以及 Radix 和 Shiki
const declared = new Set(sources.flatMap((path) => [...read(path).matchAll(/(--[\w-]+)\s*:|['"`](--[\w-]+)['"`]/g)].map((match) => match[1] ?? match[2])))

function violations(pattern: RegExp) {
  return styles.flatMap((path) => [...read(path).matchAll(pattern)].map((match) => `${relative(root, path)}: ${match[0].trim()}`))
}

describe('样式只用 tokens.css 里的设计 token', () => {
  it('不写颜色字面量', () => {
    expect(violations(/#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\([^)]*\)/gi)).toEqual([])
  })

  it('字号、字重和圆角取 token', () => {
    expect(violations(/(?:font-size|border(?:-[a-z]+)*-radius)\s*:[^;]*\d+px[^;]*;|font-weight\s*:\s*\d+/g)).toEqual([])
  })

  it('引用的变量都有定义', () => {
    const used = styles.flatMap((path) => [...read(path).matchAll(/var\((--[\w-]+)/g)].map((match) => ({ path, name: match[1] })))
    const missing = used.filter(({ name }) => !declared.has(name) && !/^--(?:radix|shiki)-/.test(name))
    expect(missing.map(({ path, name }) => `${relative(root, path)}: ${name}`)).toEqual([])
  })
})
