import { CalendarDays, CloudSun, Folder, Gauge, Music, NotebookPen, Sparkles } from 'lucide-react'
import { lazy, useMemo } from 'react'
import { useStateValue } from '../state.ts'
import { externalApp } from './external/index.ts'
import { externalAppsKey, readExternalApps } from './external/list.ts'
import { placeholderApp } from './placeholder/index.ts'
import type { AppManifest } from './types.ts'

const builtinApps: AppManifest[] = [
  {
    id: 'agent',
    name: 'Agent',
    icon: Sparkles,
    component: lazy(() => import('./agent/AgentApp.tsx').then((module) => ({ default: module.AgentApp }))),
    widgets: {
      recent: {
        name: '最近的对话',
        sizes: ['2x2', '4x2', '4x4'],
        component: lazy(() => import('./agent/AgentWidget.tsx').then((module) => ({ default: module.AgentWidget }))),
      },
    },
    settings: {
      hint: '账号、额度和登录凭证',
      component: lazy(() => import('./agent/AgentAccounts.tsx').then((module) => ({ default: module.AgentAccounts }))),
    },
  },
  {
    id: 'system',
    name: '系统',
    icon: Gauge,
    component: lazy(() => import('./system/SystemApp.tsx').then((module) => ({ default: module.SystemApp }))),
    widgets: {
      status: {
        name: '时间和状态',
        sizes: ['2x2', '4x2'],
        component: lazy(() => import('./system/SystemWidget.tsx').then((module) => ({ default: module.SystemWidget }))),
      },
    },
  },
]

const placeholderApps: AppManifest[] = [
  placeholderApp('notes', '笔记', NotebookPen),
  placeholderApp('calendar', '日历', CalendarDays),
  placeholderApp('weather', '天气', CloudSun),
  placeholderApp('music', '音乐', Music),
  placeholderApp('files', '文件', Folder),
]

// 内置的 app 加上系统状态里的外部 app，按这个顺序排列
export function useApps(): AppManifest[] {
  const value = useStateValue(externalAppsKey)
  return useMemo(() => [...builtinApps, ...readExternalApps(value).map(externalApp), ...placeholderApps], [value])
}

export const findApp = (apps: AppManifest[], id: string) => apps.find((app) => app.id === id)
