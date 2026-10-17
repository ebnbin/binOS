// 生成并加载 binOS 的 launchd 服务（正式版后端、Cloudflare Tunnel、自动上线）：BINOS_ROOT=<根目录> npm run services
// 根目录搬家或换宿主后重新执行一次
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { rootFromEnv, rootLayout } from '../server/src/layout.ts'
import { serverLabel, serverPort } from './server.ts'

const { rootDir, mainDir, buildsDir, logsDir } = rootLayout(rootFromEnv())
const agentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents')
const domain = `gui/${os.userInfo().uid}`

const tunnelTokenItem = 'binOS cloudflared tunnel'

// 用 Homebrew 的固定链接路径，brew 升级后仍然有效
const which = (command: string) => execFileSync('which', [command], { encoding: 'utf8' }).trim()
// launchd 默认的 PATH 很短，找不到 claude、git、npm；沿用安装时的 PATH，去掉 npm 运行脚本时临时加入的目录
const PATH = process.env.PATH!.split(':').filter((dir) => !dir.includes('node_modules')).join(':')

type Service = {
  label: string
  program: string[]
  env: Record<string, string>
  log: string
  workingDirectory?: string
  // 定时运行的间隔（秒）；不设置时常驻运行，退出后自动拉起
  interval?: number
}

const services: Service[] = [
  {
    label: serverLabel,
    program: [which('node'), path.join(buildsDir, 'current', 'server', 'dist', 'index.js')],
    env: { HOME: os.homedir(), PATH, BINOS_ROOT: rootDir, PORT: String(serverPort) },
    log: 'server.log',
  },
  {
    label: 'app.binos.tunnel',
    // 令牌在钥匙串里，启动时取出交给 cloudflared，不写进配置文件和命令行参数
    program: [
      '/bin/sh',
      '-c',
      `token=$(/usr/bin/security find-generic-password -s '${tunnelTokenItem}' -w) || exit 1\n` +
        `TUNNEL_TOKEN=$token exec ${which('cloudflared')} tunnel run`,
    ],
    env: { HOME: os.homedir(), PATH },
    log: 'tunnel.log',
  },
  {
    label: 'app.binos.deployer',
    // 每分钟把 main/ 更新到 GitHub 上最新的 main，再运行更新后的上线脚本：每个版本由它自己的脚本上线，
    // 坏掉的上线脚本只影响它自己，修复它的版本照样能上线
    program: [
      '/bin/sh',
      '-c',
      `${which('git')} fetch -q origin && ${which('git')} merge -q --ff-only origin/main && ` +
        `exec ${which('node')} scripts/deploy.ts deploy`,
    ],
    env: { HOME: os.homedir(), PATH, BINOS_ROOT: rootDir },
    log: 'deploy.log',
    workingDirectory: mainDir,
    interval: 60,
  },
]

mkdirSync(logsDir, { recursive: true })
for (const service of services) {
  const plistPath = path.join(agentsDir, `${service.label}.plist`)
  writeFileSync(plistPath, plist(service))
  execFileSync('plutil', ['-lint', '-s', plistPath])
  reload(service.label, plistPath)
  console.log(`已加载 ${service.label}`)
}

function plist(service: Service) {
  const logPath = path.join(logsDir, service.log)
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- 由 binOS 仓库的 scripts/services.ts 生成，不要手动修改 -->
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xml(service.label)}</string>
  <key>ProgramArguments</key>
  <array>
${service.program.map((arg) => `    <string>${xml(arg)}</string>`).join('\n')}
  </array>
  <key>EnvironmentVariables</key>
  <dict>
${Object.entries(service.env).map(([key, value]) => `    <key>${xml(key)}</key>\n    <string>${xml(value)}</string>`).join('\n')}
  </dict>
  <key>WorkingDirectory</key>
  <string>${xml(service.workingDirectory ?? rootDir)}</string>
  <key>RunAtLoad</key>
  <true/>
${service.interval ? `  <key>StartInterval</key>\n  <integer>${service.interval}</integer>` : '  <key>KeepAlive</key>\n  <true/>'}
  <!-- 不设置时 launchd 会把它当后台任务压低优先级，它启动的 agent 也会变慢 -->
  <key>ProcessType</key>
  <string>Interactive</string>
  <key>StandardOutPath</key>
  <string>${xml(logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xml(logPath)}</string>
</dict>
</plist>
`
}

function xml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function isLoaded(label: string) {
  try {
    execFileSync('launchctl', ['print', `${domain}/${label}`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// bootout 返回时服务可能还没卸载完，要等它真正卸载后再 bootstrap
function reload(label: string, plistPath: string) {
  if (isLoaded(label)) {
    execFileSync('launchctl', ['bootout', `${domain}/${label}`])
    for (let i = 0; i < 50 && isLoaded(label); i++) {
      execFileSync('sleep', ['0.2'])
    }
  }
  execFileSync('launchctl', ['bootstrap', domain, plistPath])
}
