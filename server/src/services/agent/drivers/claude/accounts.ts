import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { agentServiceDir } from '../../../../paths.js'
import { notifyChange } from '../../../../events.js'

const file = path.join(agentServiceDir, 'claude-accounts.json')
const service = 'binOS Claude account'
type Saved = { active: string; names: string[] }

function readSaved(): Saved {
  try {
    const value: Saved = JSON.parse(readFileSync(file, 'utf8'))
    if (!Array.isArray(value.names) || !value.names.every(validName) || typeof value.active !== 'string') throw new Error('Invalid accounts')
    return { names: value.names, active: value.active === 'main' || value.names.includes(value.active) ? value.active : 'main' }
  } catch {
    return { active: 'main', names: [] }
  }
}

function save(value: Saved) {
  mkdirSync(agentServiceDir, { recursive: true })
  writeFileSync(`${file}.tmp`, JSON.stringify(value) + '\n')
  renameSync(`${file}.tmp`, file)
  notifyChange({ type: 'agent' })
}

const validName = (name: string) => /^[a-z0-9][a-z0-9-]{0,31}$/.test(name) && name !== 'main'

export function validateAccountName(name: string) {
  if (!validName(name)) throw new Error('账号名只用小写字母、数字和连字符，最多 32 个字符，不能使用 main')
}

function readToken(name: string): string | undefined {
  try {
    return execFileSync('/usr/bin/security', ['find-generic-password', '-s', service, '-a', name, '-w'], {
      encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || undefined
  } catch {
    return undefined
  }
}

export const activeAccount = () => readSaved().active

export function accountSelection() {
  const saved = readSaved()
  const tokens = new Map(saved.names.map((name) => [name, readToken(name)]))
  return {
    active: saved.active,
    accounts: [{ name: 'main', available: true }, ...saved.names.map((name) => ({ name, available: Boolean(tokens.get(name)) }))],
    token: tokens.get(saved.active),
  }
}

export function selectAccount(name: string) {
  const saved = readSaved()
  if (name !== 'main' && (!saved.names.includes(name) || !readToken(name))) throw new Error('账号不存在或没有可用令牌')
  save({ ...saved, active: name })
}

// 凭证只进钥匙串；配置目录保持不变，已有会话可以继续。
export function addAccount(name: string, token: string) {
  validateAccountName(name)
  if (!/^sk-ant-[\w-]{60,}$/.test(token)) throw new Error('令牌格式不正确')
  try {
    const result = spawnSync('/usr/bin/security', ['-i'], {
      input: `add-generic-password -U -s "${service}" -a "${name}" -w "${token}"\n`,
      timeout: 5000, encoding: 'utf8', stdio: ['pipe', 'ignore', 'pipe'],
    })
    if (result.error || result.status !== 0 || result.stderr?.trim()) throw new Error('Keychain write failed')
  } catch {
    throw new Error('没能将账号令牌存入钥匙串')
  }
  const saved = readSaved()
  save({ ...saved, names: [...new Set([...saved.names, name])] })
}
