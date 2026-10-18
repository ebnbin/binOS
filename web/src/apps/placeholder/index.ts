import type { LucideIcon } from 'lucide-react'
import { createElement } from 'react'
import type { AppContext, AppManifest, WidgetProps } from '../types.ts'
import { PlaceholderApp, PlaceholderWidget } from './placeholder.tsx'

// 占位 app：用来检查桌面和分屏，有了真正的 app 后逐个删掉
export function placeholderApp(id: string, name: string, icon: LucideIcon): AppManifest {
  return {
    id,
    name,
    icon,
    component: ({ ctx }: { ctx: AppContext }) => createElement(PlaceholderApp, { ctx, name, icon }),
    widgets: {
      main: {
        name,
        sizes: ['2x2', '4x2', '4x4'],
        component: (props: WidgetProps) => createElement(PlaceholderWidget, { ...props, name, icon }),
      },
    },
  }
}
