/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { Blend, Hct, MaterialDynamicColors, SchemeTonalSpot, TonalPalette, argbFromHex, hexFromArgb } from '@material/material-color-utilities'
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
    expect(violations(/(?:font(?:-size)?|border(?:-[a-z]+)*-radius)\s*:[^;]*\d+px[^;]*;|font-weight\s*:\s*\d+/g)).toEqual([])
  })

  it('引用的变量都有定义', () => {
    const used = styles.flatMap((path) => [...read(path).matchAll(/var\((--[\w-]+)/g)].map((match) => ({ path, name: match[1] })))
    const missing = used.filter(({ name }) => !declared.has(name) && !/^--(?:radix|shiki)-/.test(name))
    expect(missing.map(({ path, name }) => `${relative(root, path)}: ${name}`)).toEqual([])
  })
})

// M3 的基准源色；自定义颜色按 M3 的做法向源色协调后取色调
const source = '#6750A4'
const custom = { success: '#1E8E3E', info: '#1A73E8', warning: '#E37400' }
const roles = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'inversePrimary',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'surface', 'surfaceDim', 'surfaceBright', 'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer',
  'surfaceContainerHigh', 'surfaceContainerHighest', 'onSurface', 'onSurfaceVariant', 'surfaceVariant',
  'inverseSurface', 'inverseOnSurface', 'outline', 'outlineVariant', 'shadow', 'scrim',
] as const

function scheme(dark: boolean) {
  const generated = new SchemeTonalSpot(Hct.fromInt(argbFromHex(source)), dark, 0, '2021')
  const colors = roles.map((role) => [`--md-sys-color-${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, hexFromArgb(MaterialDynamicColors[role].getArgb(generated))])
  for (const [name, hex] of Object.entries(custom)) {
    const palette = TonalPalette.fromInt(Blend.harmonize(argbFromHex(hex), argbFromHex(source)))
    const [color, on, container, onContainer] = (dark ? [80, 20, 30, 90] : [40, 100, 90, 10]).map((tone) => hexFromArgb(palette.tone(tone)))
    colors.push([`--md-sys-color-${name}`, color], [`--md-sys-color-on-${name}`, on], [`--md-sys-color-${name}-container`, container], [`--md-sys-color-on-${name}-container`, onContainer])
  }
  return Object.fromEntries(colors)
}

describe('颜色角色由 Material 3 的配色算法生成', () => {
  const tokens = read(join(root, 'tokens.css'))
  const [light, dark] = tokens.split('@media (prefers-color-scheme: dark)')
  const declarations = (css: string) => Object.fromEntries([...css.matchAll(/(--md-sys-color-[\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2]]))

  it('亮色', () => {
    expect(declarations(light)).toEqual(scheme(false))
  })

  it('暗色', () => {
    expect(declarations(dark)).toEqual(scheme(true))
  })
})
