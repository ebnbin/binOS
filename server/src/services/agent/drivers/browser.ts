import { configDir as claudeConfigDir } from './claude/auth.js'

// 操作本机 Chrome 的 MCP 服务：Claude in Chrome 扩展经 Claude Code 提供的那一个，单独启动，给自己没有浏览器的 agent 用。
// 用 Claude 的配置目录，才能连上 Claude Code 登记的 native host
export const browserMcpServer = {
  command: 'claude',
  args: ['--claude-in-chrome-mcp'],
  env: { CLAUDE_CONFIG_DIR: claudeConfigDir },
}
