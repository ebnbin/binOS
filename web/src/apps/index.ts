import { CalendarDays, CloudSun, CodeXml, Folder, Gauge, Music, NotebookPen } from 'lucide-react'
import { lazy, useMemo } from 'react'
import { externalApp } from './external/index.ts'
import { placeholderApp } from './placeholder/index.ts'
import { useExternalApps } from './registry.ts'
import type { AppManifest } from './types.ts'

const builtinApps: AppManifest[] = [
  {
    id: 'code',
    name: 'Code',
    icon: CodeXml,
    component: lazy(() => import('./code/CodeApp.tsx').then((module) => ({ default: module.CodeApp }))),
    widgets: {
      recent: {
        name: '最近的对话',
        sizes: ['2x2', '4x2', '4x4'],
        component: lazy(() => import('./code/CodeWidget.tsx').then((module) => ({ default: module.CodeWidget }))),
      },
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

// 内置的 app 加上 app 注册表里的外部 app，按这个顺序排列
export function useApps(): AppManifest[] {
  const external = useExternalApps()
  return useMemo(() => [...builtinApps, ...(external ?? []).map(externalApp), ...placeholderApps], [external])
}

// 读到 app 注册表之前，还不知道有哪些外部 app
export const useAppsLoaded = () => useExternalApps() !== undefined

export const findApp = (apps: AppManifest[], id: string) => apps.find((app) => app.id === id)
