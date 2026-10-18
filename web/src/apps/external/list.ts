import type { JsonValue } from '@binos/server/types'
import { updateState } from '../../state.ts'
import { iconNames } from './icons.ts'
import type { IconName } from './icons.ts'

// 系统状态 apps/external：外部 app 的清单。它是私有数据，可能有不公开的 app，不写进代码
export const externalAppsKey = 'apps/external'

export type ExternalAppConfig = { id: string; name: string; icon: IconName; url: string }

// 还没有改过清单时用这一份，都是公开的项目
const defaultExternalApps: ExternalAppConfig[] = [
  { id: 'puzzles', name: 'Puzzles', icon: 'puzzle', url: 'https://puzzles.ebnbin.dev/' },
  { id: 'warmoji', name: 'WarMoji', icon: 'swords', url: 'https://warmoji.ebnbin.dev/' },
]

export function isWebUrl(url: string) {
  try {
    return ['https:', 'http:'].includes(new URL(url).protocol)
  } catch {
    return false
  }
}

// 跳过不完整的项
export function readExternalApps(value: JsonValue): ExternalAppConfig[] {
  if (!Array.isArray(value)) {
    return defaultExternalApps
  }
  return value.flatMap((item) => {
    const { id, name, icon, url } = (item ?? {}) as Record<string, unknown>
    if (typeof id !== 'string' || typeof name !== 'string' || typeof url !== 'string' || !isWebUrl(url)) {
      return []
    }
    return [{ id, name, url, icon: iconNames.includes(icon as IconName) ? (icon as IconName) : 'app-window' }]
  })
}

export function saveExternalApps(list: ExternalAppConfig[]) {
  updateState([{ key: externalAppsKey, value: list }])
}
