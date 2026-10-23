import { CalendarColor } from '@fluentui/react-icons/headless/svg/calendar'
import { CodeColor } from '@fluentui/react-icons/headless/svg/code'
import { CodeBlockColor } from '@fluentui/react-icons/headless/svg/code-block'
import { DocumentFolderColor } from '@fluentui/react-icons/headless/svg/document-folder'
import { GlobeColor } from '@fluentui/react-icons/headless/svg/globe'
import { HeadphonesColor } from '@fluentui/react-icons/headless/svg/headphones'
import { SettingsColor } from '@fluentui/react-icons/headless/svg/settings'
import { lazy } from 'react'
import type { ApplicationDefinition } from './types.ts'

export const builtinApplications: ApplicationDefinition[] = [
  {
    id: 'calendar',
    name: '日历',
    icon: CalendarColor,
    views: {
      month: { kind: 'widget', component: lazy(() => import('./calendar/CalendarWidget.tsx').then((module) => ({ default: module.CalendarWidget }))) },
    },
    widgets: { main: { name: '月历', viewId: 'month', sizes: ['4x4'] } },
  },
  {
    id: 'music',
    name: '音乐',
    icon: HeadphonesColor,
    mainWindow: { viewId: 'main' },
    views: {
      main: { kind: 'window', component: lazy(() => import('./music/MusicApp.tsx').then((module) => ({ default: module.MusicApp }))) },
      widget: { kind: 'widget', component: lazy(() => import('./music/MusicWidget.tsx').then((module) => ({ default: module.MusicWidget }))) },
    },
    widgets: { main: { name: '正在播放', viewId: 'widget', sizes: ['2x2', '4x2', '4x4'] } },
  },
  {
    id: 'browser',
    name: '浏览器',
    icon: GlobeColor,
    mainWindow: { viewId: 'main' },
    views: {
      main: {
        kind: 'window',
        component: lazy(() => import('./browser/BrowserApp.tsx').then((module) => ({ default: module.BrowserApp }))),
      },
    },
  },
  {
    id: 'terminal',
    name: '终端',
    icon: CodeBlockColor,
    mainWindow: { viewId: 'main' },
    views: {
      main: {
        kind: 'window',
        component: lazy(() => import('./terminal/TerminalApp.tsx').then((module) => ({ default: module.TerminalApp }))),
      },
    },
  },
  {
    id: 'files',
    name: '文件',
    icon: DocumentFolderColor,
    mainWindow: { viewId: 'main' },
    views: {
      main: {
        kind: 'window',
        component: lazy(() => import('./files/FilesApp.tsx').then((module) => ({ default: module.FilesApp }))),
      },
    },
  },
  {
    id: 'code',
    name: 'Code',
    icon: CodeColor,
    mainWindow: { viewId: 'main' },
    views: {
      main: {
        kind: 'window',
        component: lazy(() => import('./code/CodeApp.tsx').then((module) => ({ default: module.CodeApp }))),
      },
      recent: {
        kind: 'widget',
        component: lazy(() => import('./code/CodeWidget.tsx').then((module) => ({ default: module.CodeWidget }))),
      },
    },
    widgets: { recent: { name: '最近的对话', viewId: 'recent', sizes: ['2x2', '4x2', '4x4'] } },
  },
  {
    id: 'system',
    name: '系统',
    icon: SettingsColor,
    mainWindow: { viewId: 'main' },
    views: {
      main: {
        kind: 'window',
        component: lazy(() => import('./system/SystemApp.tsx').then((module) => ({ default: module.SystemApp }))),
      },
      status: {
        kind: 'widget',
        component: lazy(() => import('./system/SystemWidget.tsx').then((module) => ({ default: module.SystemWidget }))),
      },
    },
    widgets: { status: { name: '时间和状态', viewId: 'status', sizes: ['2x2', '4x2'] } },
  },
]
