import { CalendarDays, CloudSun, Folder, Gauge, Globe, Music, NotebookPen, Sparkles } from 'lucide-react'
import { lazy } from 'react'
import { placeholderApp } from './placeholder/index.ts'
import type { AppManifest } from './types.ts'

export const apps: AppManifest[] = [
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
  {
    id: 'browser',
    name: '浏览器',
    icon: Globe,
    component: lazy(() => import('./browser/BrowserApp.tsx').then((module) => ({ default: module.BrowserApp }))),
  },
  placeholderApp('notes', '笔记', NotebookPen),
  placeholderApp('calendar', '日历', CalendarDays),
  placeholderApp('weather', '天气', CloudSun),
  placeholderApp('music', '音乐', Music),
  placeholderApp('files', '文件', Folder),
]

export const findApp = (id: string) => apps.find((app) => app.id === id)
