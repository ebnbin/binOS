import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const { secrets, security } = vi.hoisted(() => {
  const secrets = new Map<string, string>()
  const security = vi.fn<(command: string, args: string[], options?: { input?: string }) => string>((_command, args, options) => {
    if (args[0] === '-i') {
      const input = options?.input ?? ''
      secrets.set(/-a "([^"]+)"/.exec(input)![1], /-w "([^"]+)"/.exec(input)![1])
      return ''
    }
    const token = secrets.get(args[args.indexOf('-a') + 1])
    if (!token) throw new Error('Not found')
    return token
  })
  return { secrets, security }
})
vi.mock('node:child_process', async (original) => ({ ...await original<typeof import('node:child_process')>(), execFileSync: security, spawnSync: (...args: Parameters<typeof security>) => ({ status: 0, stderr: security(...args) }) }))
const root = mkdtempSync(path.join(os.tmpdir(), 'binos-accounts-'))
process.env.BINOS_ROOT = root
const { agentServiceDir } = await import('../../../../paths.js')
const { addAccount, selectAccount, accountSelection, validateAccountName } = await import('./accounts.js')
const { claudeAuthEnv, claudeAuthFailed } = await import('./auth.js')
const { allLimits, saveLimits } = await import('../../limits.js')
const file = path.join(agentServiceDir, 'claude-accounts.json')
const token = `sk-ant-${'x'.repeat(70)}`

describe('Claude accounts', () => {
  it('保留主账号，凭证只写入钥匙串，不进入列表与元数据', () => {
    expect(accountSelection().active).toBe('main')
    addAccount('personal', token)
    addAccount('personal', token)
    expect(accountSelection().accounts.map((item) => item.name)).toEqual(['main', 'personal'])
    expect(readFileSync(file, 'utf8')).not.toContain(token)
    expect(security.mock.calls.find((call) => call[1][0] === '-i')?.[1]).toEqual(['-i'])
    selectAccount('personal')
    expect(claudeAuthEnv().CLAUDE_CODE_OAUTH_TOKEN).toBe(token)
  })

  it('切换后的旧回答仍把额度归给原账号，认证失败不标坏当前账号', () => {
    const limits = (utilization: number) => ({ limited: false, windows: [{ id: 'five', minutes: 300, utilization, resetsAt: 1 }], updatedAt: 'now' })
    saveLimits('claude', limits(0.1), 'main')
    saveLimits('claude', limits(0.7), 'personal')
    expect(allLimits().claude?.windows[0].utilization).toBe(0.7)
    selectAccount('main')
    saveLimits('claude', limits(0.8), 'personal')
    expect(allLimits().claude?.windows[0].utilization).toBe(0.1)
    expect(claudeAuthFailed('personal')).toContain('personal')
    selectAccount('personal')
    expect(allLimits().claude?.windows[0].utilization).toBe(0.8)
  })

  it('令牌丢失时不回退到其他账号，拒绝无效名称和不存在的账号', () => {
    secrets.clear()
    expect(accountSelection().accounts.find((item) => item.name === 'personal')?.available).toBe(false)
    expect(claudeAuthEnv().CLAUDE_CODE_OAUTH_TOKEN).toBe('')
    expect(() => selectAccount('personal')).toThrow('账号不存在或没有可用令牌')
    expect(() => selectAccount('missing')).toThrow('账号不存在或没有可用令牌')
    for (const name of ['main', '../outside', 'bad"name', '', 'a'.repeat(33)]) expect(() => validateAccountName(name)).toThrow('账号名只用')
  })

  it('钥匙串失败不保存账号或暴露令牌，重启读取已有选择', async () => {
    security.mockImplementationOnce(() => { throw new Error(token) })
    expect(() => addAccount('failed', token)).toThrow('没能将账号令牌存入钥匙串')
    expect(readFileSync(file, 'utf8')).not.toContain('failed')
    security.mockImplementationOnce(() => token)
    expect(() => addAccount('failed', token)).toThrow('没能将账号令牌存入钥匙串')
    expect(readFileSync(file, 'utf8')).not.toContain('failed')
    writeFileSync(file, JSON.stringify({ active: 'personal', names: ['personal'] }))
    vi.resetModules()
    const reloaded = await import('./accounts.js')
    expect(reloaded.accountSelection().active).toBe('personal')
  })
})
