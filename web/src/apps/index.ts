import { Gauge, Sparkles } from 'lucide-react'
import { lazy } from 'react'
import type { AppManifest } from './types.ts'

export const apps: AppManifest[] = [
  {
    id: 'agent',
    name: 'Agent',
    icon: Sparkles,
    // 宽度不小于 960 时 Agent 两栏并排
    defaultSize: { width: 960, height: 680 },
    component: lazy(() => import('./agent/AgentApp.tsx').then((module) => ({ default: module.AgentApp }))),
  },
  {
    id: 'system',
    name: '系统',
    icon: Gauge,
    defaultSize: { width: 420, height: 300 },
    component: lazy(() => import('./system/SystemApp.tsx').then((module) => ({ default: module.SystemApp }))),
  },
]

export const findApp = (id: string) => apps.find((app) => app.id === id)
