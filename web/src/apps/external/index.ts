import { createElement } from 'react'
import type { AppContext, AppManifest } from '../types.ts'
import { ExternalApp } from './ExternalApp.tsx'
import { icons } from './icons.ts'
import type { ExternalAppConfig } from './list.ts'

// 同样的配置返回同一个对象：组件换了，React 会重新挂载 iframe，正在用的 app 会重新加载
const cache = new Map<string, AppManifest>()

// 独立部署的 web app，在窗口里用 iframe 打开 url
export function externalApp(config: ExternalAppConfig): AppManifest {
  const key = JSON.stringify(config)
  let manifest = cache.get(key)
  if (!manifest) {
    const { id, name, icon, url } = config
    manifest = {
      id,
      name,
      icon: icons[icon],
      external: true,
      component: ({ ctx }: { ctx: AppContext }) => createElement(ExternalApp, { ctx, name, url }),
    }
    cache.set(key, manifest)
  }
  return manifest
}
