import type { ApplicationDefinition } from '../../apps/types.ts'
import { findApplication } from '../../apps/definitions.ts'
import { createWindow, getWindows } from '../state/windows.ts'

// 当前入口始终复用 app 已有的窗口；实例存储不承担这个策略。
export function ensureApplicationWindow(applications: ApplicationDefinition[], applicationId: string): string | undefined {
  const application = findApplication(applications, applicationId)
  if (application && !application.mainWindow) return undefined
  const existing = Object.values(getWindows().windows).find((win) => win.applicationId === applicationId)
  if (existing) return existing.id
  const viewId = application?.mainWindow?.viewId ?? 'main'
  return createWindow(applicationId, viewId)
}
