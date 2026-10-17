import type { JsonValue, StateChange } from '@binos/server/types'
import { useSyncExternalStore } from 'react'
import { readState, writeState } from './api.ts'
import { onChange } from './events.ts'
import { StateStore } from './state-store.ts'

const store = new StateStore()
let started = false

function load() {
  readState()
    .then(({ version, entries }) => store.applySnapshot(version, entries))
    .catch(() => {})
}

// 每次连上全局通知时（包括第一次）读取快照：连上之前的改动都在快照里，之后的都会推送过来
function subscribe(listener: () => void) {
  if (!started) {
    started = true
    onChange((event) => {
      if (event === null) {
        load()
      } else if (event.type === 'state') {
        store.applyRemote(event.version, event.changes)
      }
    })
  }
  return store.subscribe(listener)
}

export function getState(key: string): JsonValue {
  return store.get(key)
}

export function listState(prefix: string): [string, JsonValue][] {
  return store.list(prefix)
}

export function updateState(changes: StateChange[]) {
  store.writeLocal(changes)
  void writeState(changes).then((version) => {
    if (store.settleLocal(changes, version)) {
      load()
    }
  })
}

export function useStateLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => store.loaded)
}

export function useStateValue(key: string): JsonValue {
  return useSyncExternalStore(subscribe, () => store.get(key))
}

export function useStateList(prefix: string): [string, JsonValue][] {
  return useSyncExternalStore(subscribe, () => store.list(prefix))
}
