import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { AgentModel } from '../../types.js'

type ListedModel = {
  value: string
  resolvedModel?: string
  displayName: string
  supportedEffortLevels?: string[]
}

let cached: { key: string; at: number; models: Promise<AgentModel[]> } | undefined

export function claudeModels(env: NodeJS.ProcessEnv): Promise<AgentModel[]> {
  const key = createHash('sha256').update(JSON.stringify([env.CLAUDE_CONFIG_DIR, env.BINOS_CLAUDE_ACCOUNT, env.CLAUDE_CODE_OAUTH_TOKEN])).digest('hex')
  if (!cached || cached.key !== key || Date.now() - cached.at > 10 * 60_000) {
    cached = { key, at: Date.now(), models: readModels(env) }
  }
  return cached.models
}

function readModels(env: NodeJS.ProcessEnv): Promise<AgentModel[]> {
  return new Promise((resolve) => {
    const child = spawn('claude', ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose'], {
      env,
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    const finish = (models: AgentModel[]) => {
      clearTimeout(timer)
      resolve(models)
      child.kill()
    }
    const timer = setTimeout(() => finish([]), 15_000)
    child.on('error', () => finish([]))
    child.on('exit', () => finish([]))
    child.stdin.on('error', () => finish([]))
    createInterface({ input: child.stdout }).on('line', (line) => {
      try {
        const message = JSON.parse(line) as {
          type: string
          response?: { request_id?: string; response?: { models?: ListedModel[] } }
        }
        if (message.type !== 'control_response' || message.response?.request_id !== 'catalog') return
        const list = message.response.response?.models ?? []
        const defaultModel = list.find((model) => model.value === 'default')
        const models = list.filter((model) => model.value !== 'default').map((model) => ({
          id: model.value,
          name: model.displayName,
          efforts: model.supportedEffortLevels ?? [],
          ...(defaultModel?.resolvedModel && model.resolvedModel === defaultModel.resolvedModel && { isDefault: true }),
        }))
        if (defaultModel?.resolvedModel && !models.some((model) => model.isDefault)) {
          models.unshift({ id: defaultModel.resolvedModel, name: defaultModel.resolvedModel, efforts: defaultModel.supportedEffortLevels ?? [], isDefault: true })
        }
        finish(models)
      } catch {
        // 忽略控制协议之外的输出
      }
    })
    child.stdin.end(JSON.stringify({ type: 'control_request', request_id: 'catalog', request: { subtype: 'initialize' } }) + '\n')
  })
}
