import type { StateChange } from '@binos/server/types'
import { findApp } from '../apps/index.ts'
import { getState, listState, updateState } from '../state.ts'
import { normalizeFocus, placeFrame, raise } from './layout.ts'
import type { Area, Focus, Form, Frame } from './layout.ts'

// 系统状态里的窗口：
// shell/windows/<id> → { app, route }：开着哪些窗口、各自在 app 的哪一页，所有设备共用
// shell/frames/<id> → Frame：桌面上的位置和大小
// shell/focus/<form> → Focus：层级和聚焦，桌面和手机各一份
export type WindowState = { app: string; route: string }

export const windowPrefix = 'shell/windows/'
export const framePrefix = 'shell/frames/'
export const focusKey = (form: Form) => `shell/focus/${form}`

const windowIds = () => listState(windowPrefix).map(([key]) => key.slice(windowPrefix.length))
const readFocus = (form: Form) => normalizeFocus(getState(focusKey(form)) as Focus | null, windowIds())
const readFrame = (id: string) => getState(framePrefix + id) as Frame | null

// 每个 app 目前最多一个窗口：已经开着就聚焦它，最小化了就恢复。手机上打开时不定位置，第一次在桌面上显示时再定
export function openApp(appId: string, form: Form, area?: Area) {
  const existing = listState(windowPrefix).find(([, value]) => (value as WindowState).app === appId)
  if (existing) {
    focusWindow(existing[0].slice(windowPrefix.length), form)
    return
  }
  const app = findApp(appId)
  if (!app) {
    return
  }
  const id = crypto.randomUUID()
  updateState([
    { key: windowPrefix + id, value: { app: appId, route: '/' } },
    ...(area ? [{ key: framePrefix + id, value: placeFrame(app.defaultSize, area, windowIds().length) }] : []),
    { key: focusKey(form), value: raise(readFocus(form), id) },
  ])
}

export function focusWindow(id: string | null, form: Form) {
  const changes: StateChange[] = [{ key: focusKey(form), value: id ? raise(readFocus(form), id) : { ...readFocus(form), focused: null } }]
  const frame = id && readFrame(id)
  if (frame && frame.minimized) {
    changes.push({ key: framePrefix + id, value: { ...frame, minimized: false } })
  }
  updateState(changes)
}

export function closeWindow(id: string) {
  updateState([
    { key: windowPrefix + id, value: null },
    { key: framePrefix + id, value: null },
  ])
}

export function minimizeWindow(id: string, form: Form) {
  const frame = readFrame(id)
  const focus = readFocus(form)
  updateState([
    ...(frame ? [{ key: framePrefix + id, value: { ...frame, minimized: true } }] : []),
    { key: focusKey(form), value: { ...focus, focused: focus.focused === id ? null : focus.focused } },
  ])
}

export function setFrame(id: string, frame: Frame) {
  updateState([{ key: framePrefix + id, value: frame }])
}

export function setRoute(id: string, route: string) {
  const current = getState(windowPrefix + id) as WindowState | null
  if (current) {
    updateState([{ key: windowPrefix + id, value: { ...current, route } }])
  }
}
