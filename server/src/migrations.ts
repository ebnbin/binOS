import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { accessPath, agentDataDir, agentRunsDir, appDir, libraryDir, registryPath } from './paths.js'
import { parseExternalApp, writeRegistry } from './registry.js'

// 后端启动时、各 app 启动前执行的数据迁移。每一步都先看是否已经做过，可以重复执行
export function migrate() {
  moveCodeToApps()
  removeState()
  moveAccessConfig()
}

// Code 的数据从 Library/code 挪到 Library/Apps/code。进行中的 agent 运行记着工具结果图片的存放目录，跟着改
function moveCodeToApps() {
  const from = path.join(libraryDir, 'code')
  const to = appDir('code')
  if (existsSync(from) && !existsSync(to)) {
    mkdirSync(path.dirname(to), { recursive: true })
    renameSync(from, to)
  }

  if (!existsSync(agentRunsDir)) {
    return
  }
  const prefix = from + path.sep
  for (const id of readdirSync(agentRunsDir)) {
    const file = path.join(agentRunsDir, id, 'state.json')
    const state = readJson<{ options: { filesDir: string } }>(file)
    const filesDir = state?.options.filesDir
    if (filesDir?.startsWith(prefix)) {
      const options = { ...state!.options, filesDir: path.join(to, filesDir.slice(prefix.length)) }
      writeFileSync(`${file}.tmp`, JSON.stringify({ ...state, options }) + '\n')
      renameSync(`${file}.tmp`, file)
    }
  }
}

// 系统状态（Library/state.json）拆掉：agent 的额度挪到 agent 服务自己的数据目录，外部 app 的清单挪到 app 注册表。
// 登录的状况和 Code 的用量改为现查，窗口和分屏布局改为每台设备自己记，其余的都不再使用
function removeState() {
  const file = path.join(libraryDir, 'state.json')
  if (!existsSync(file)) {
    return
  }
  const { entries } = JSON.parse(readFileSync(file, 'utf8')) as { entries: Record<string, { value: unknown }> }
  const value = (key: string) => entries[key]?.value

  const limitsPath = path.join(agentDataDir, 'limits.json')
  const limits = Object.fromEntries(Object.entries({ claude: value('agent/limits'), codex: value('agent/codex-limits') }).filter(([, item]) => item !== undefined))
  if (Object.keys(limits).length > 0 && !existsSync(limitsPath)) {
    mkdirSync(agentDataDir, { recursive: true })
    writeFileSync(`${limitsPath}.tmp`, JSON.stringify(limits, null, 2) + '\n')
    renameSync(`${limitsPath}.tmp`, limitsPath)
  }

  // 原来的清单里，图标不对的用默认图标，其他不完整的项跳过
  const external = value('apps/external')
  if (Array.isArray(external) && !existsSync(registryPath)) {
    const apps = external.flatMap((item: object) => parseExternalApp(item) ?? parseExternalApp({ ...item, icon: 'app-window' }) ?? [])
    writeRegistry({ external: apps })
  }

  rmSync(file)
}

// Library/config.json 改为 Library/binos/access.json，去掉 access 这一层。
// 原文件留着：上线失败回退到旧版本时，旧版本还要读它
function moveAccessConfig() {
  const old = readJson<{ access: { teamDomain: string; aud: string }; ownerEmail: string }>(path.join(libraryDir, 'config.json'))
  if (!old || existsSync(accessPath)) {
    return
  }
  mkdirSync(path.dirname(accessPath), { recursive: true })
  writeFileSync(`${accessPath}.tmp`, JSON.stringify({ ...old.access, ownerEmail: old.ownerEmail }, null, 2) + '\n')
  renameSync(`${accessPath}.tmp`, accessPath)
}

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}
