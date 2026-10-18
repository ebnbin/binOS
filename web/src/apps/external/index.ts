import type { LucideIcon } from 'lucide-react'
import { createElement } from 'react'
import type { AppContext, AppManifest } from '../types.ts'
import { ExternalApp } from './ExternalApp.tsx'

// 独立部署的 web app，在窗口里用 iframe 打开 url
export function externalApp(id: string, name: string, icon: LucideIcon, url: string): AppManifest {
  return {
    id,
    name,
    icon,
    component: ({ ctx }: { ctx: AppContext }) => createElement(ExternalApp, { ctx, name, url }),
  }
}
