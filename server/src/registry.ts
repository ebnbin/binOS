import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { notifyChange } from './events.js'
import { registryPath } from './paths.js'
import type { AppRegistry, ExternalApp } from './types.js'

// app 注册表，所有设备共用。外部 app 的清单是私有数据，可能有不公开的 app，不写进代码。
// 只有这个后端读写这个文件（根目录锁保证），所以启动后一直以内存里的为准

// 还没有改过清单时用这一份，都是公开的项目
const defaultRegistry: AppRegistry = {
  external: [
    { id: 'puzzles', name: 'Puzzles', icon: 'puzzle', url: 'https://puzzles.ebnbin.dev/' },
    { id: 'warmoji', name: 'WarMoji', icon: 'swords', url: 'https://warmoji.ebnbin.dev/' },
  ],
}

// id 和图标名
const slugPattern = /^[a-z0-9-]{1,40}$/
const maxApps = 100

let saved: AppRegistry | undefined

export function readRegistry(): AppRegistry {
  saved ??= existsSync(registryPath) ? (JSON.parse(readFileSync(registryPath, 'utf8')) as AppRegistry) : defaultRegistry
  return saved
}

function isWebUrl(url: string) {
  try {
    return ['https:', 'http:'].includes(new URL(url).protocol)
  } catch {
    return false
  }
}

// 不合规时返回 undefined。名称和网址去掉首尾空白
export function parseExternalApp(input: unknown): ExternalApp | undefined {
  const { id, name, icon, url } = (input ?? {}) as Record<string, unknown>
  if (typeof id !== 'string' || typeof name !== 'string' || typeof icon !== 'string' || typeof url !== 'string') {
    return undefined
  }
  const app = { id, name: name.trim(), icon, url: url.trim() }
  const valid = slugPattern.test(id) && slugPattern.test(icon) && app.name !== '' && app.name.length <= 100 && app.url.length <= 2000 && isWebUrl(app.url)
  return valid ? app : undefined
}

// 整份清单，id 不能重复；有一项不合规就整份拒绝
export function parseExternalApps(input: unknown): ExternalApp[] | undefined {
  if (!Array.isArray(input) || input.length > maxApps) {
    return undefined
  }
  const apps = input.map(parseExternalApp)
  const valid = apps.every(Boolean) && new Set(apps.map((app) => app!.id)).size === apps.length
  return valid ? (apps as ExternalApp[]) : undefined
}

// 写入文件成功后才替换内存里的注册表，失败时内存和文件都保持原样
export function saveRegistry(registry: AppRegistry) {
  writeRegistry(registry)
  saved = registry
  notifyChange({ type: 'apps' })
}

// 先写临时文件并落盘，再改名覆盖：中途崩溃时文件仍是上一次的完整内容
export function writeRegistry(registry: AppRegistry) {
  mkdirSync(path.dirname(registryPath), { recursive: true })
  const temp = `${registryPath}.tmp`
  const fd = openSync(temp, 'w')
  try {
    writeFileSync(fd, JSON.stringify(registry, null, 2) + '\n')
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(temp, registryPath)
}
