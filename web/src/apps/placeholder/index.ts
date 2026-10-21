import type { LucideIcon } from 'lucide-react'
import { createElement } from 'react'
import type { WindowContext, ApplicationDefinition, WidgetContext } from '../types.ts'
import { PlaceholderApp, PlaceholderWidget } from './placeholder.tsx'

// 占位 app：用来检查桌面和分屏，有了真正的 app 后逐个删掉
export function placeholderApp(id: string, name: string, icon: LucideIcon): ApplicationDefinition {
  return {
    id,
    name,
    icon,
    mainWindow: { viewId: 'main' },
    views: {
      main: { kind: 'window', component: ({ ctx }: { ctx: WindowContext }) => createElement(PlaceholderApp, { ctx, name, icon }) },
      widget: { kind: 'widget', component: (props: WidgetContext) => createElement(PlaceholderWidget, { ...props, name, icon }) },
    },
    widgets: {
      main: {
        name,
        sizes: ['2x2', '4x2', '4x4'],
        viewId: 'widget',
      },
    },
  }
}
