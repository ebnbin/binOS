import { lazy } from 'react'
import type { AppManifest } from './types.ts'

export const apps: AppManifest[] = [
  {
    id: 'agent',
    name: 'Agent',
    component: lazy(() => import('./agent/AgentApp.tsx').then((module) => ({ default: module.AgentApp }))),
  },
]
