import { spawn } from 'node:child_process'

try {
  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk.toString()
    if (input.length > 64 * 1024) throw new Error('设备命令输入过大')
  }
  const command = JSON.parse(input) as string[]
  const child = spawn(command[0], command.slice(1), { stdio: ['ignore', 'inherit', 'inherit'] })
  child.on('error', (error) => { console.error(error.message); process.exitCode = 1 })
  child.on('close', (code) => { process.exitCode = code ?? 1 })
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
