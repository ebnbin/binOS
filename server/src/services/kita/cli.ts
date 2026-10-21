import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { promisify } from 'node:util'

const run = promisify(execFile)
const timeout = 15_000

// 查账号用的命令行工具的输出；没装、出错或超时时返回 undefined
export async function commandOutput(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<string | undefined> {
  try {
    return (await run(command, args, { env, timeout })).stdout.trim()
  } catch {
    return undefined
  }
}

export function readText(file: string): string | undefined {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return undefined
  }
}

export function parseJson<T>(text: string | undefined): T | undefined {
  try {
    return text ? (JSON.parse(text) as T) : undefined
  } catch {
    return undefined
  }
}

export const isoFromSeconds = (seconds: number | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : undefined)
