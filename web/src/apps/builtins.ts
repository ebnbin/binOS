import { CalendarDays, CloudSun, CodeXml, Folder, Gauge, Music, NotebookPen } from 'lucide-react'
import { lazy } from 'react'
import { placeholderApp } from './placeholder/index.ts'
import type { ApplicationDefinition } from './types.ts'

export const builtinApplications: ApplicationDefinition[] = [
  {
    id: 'music',
    name: '音乐',
    icon: Music,
    mainWindow: { viewId: 'main' },
    views: {
      main: { kind: 'window', component: lazy(() => import('./music/MusicApp.tsx').then((module) => ({ default: module.MusicApp }))) },
      widget: { kind: 'widget', component: lazy(() => import('./music/MusicWidget.tsx').then((module) => ({ default: module.MusicWidget }))) },
    },
    widgets: { main: { name: '正在播放', viewId: 'widget', sizes: ['2x2', '4x2', '4x4'] } },
  },
  {
    id: 'files',
    name: '文件',
    icon: Folder,
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
    icon: CodeXml,
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
    icon: Gauge,
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

export const placeholderApplications: ApplicationDefinition[] = [
  placeholderApp('notes', '笔记', NotebookPen),
  placeholderApp('calendar', '日历', CalendarDays),
  placeholderApp('weather', '天气', CloudSun),
]
