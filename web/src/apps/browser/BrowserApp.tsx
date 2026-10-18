import type { TabState } from '@binos/server/apps/browser/types'
import { ArrowLeft, ArrowRight, Keyboard, RotateCw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { IconButton } from '../../ui/IconButton.tsx'
import type { AppContext } from '../types.ts'
import { navigate, runAction } from './api.ts'
import styles from './BrowserApp.module.css'
import { Screen } from './Screen.tsx'

const initialState: TabState = { url: '', title: '', loading: false, canGoBack: false, canGoForward: false }

// 显示 Mac 上运行的 Chrome，只有一个标签页
export function BrowserApp({ ctx }: { ctx: AppContext }) {
  const [state, setState] = useState(initialState)
  // 正在编辑的地址；没在编辑时显示当前网址
  const [address, setAddress] = useState<string | null>(null)
  const keyboardRef = useRef<HTMLTextAreaElement>(null)

  const url = state.url === 'about:blank' ? '' : state.url
  const { setTitle } = ctx
  useEffect(() => setTitle(url ? state.title : ''), [setTitle, url, state.title])

  return (
    <div className={styles.app}>
      <header className={styles.bar}>
        <IconButton icon={ArrowLeft} label="后退" disabled={!state.canGoBack} onClick={() => void runAction('back')} />
        <IconButton icon={ArrowRight} label="前进" disabled={!state.canGoForward} onClick={() => void runAction('forward')} />
        {state.loading ? (
          <IconButton icon={X} label="停止" onClick={() => void runAction('stop')} />
        ) : (
          <IconButton icon={RotateCw} label="重新加载" disabled={!url} onClick={() => void runAction('reload')} />
        )}
        <form
          className={styles.address}
          onSubmit={(event) => {
            event.preventDefault()
            if (address?.trim()) {
              void navigate(address)
            }
            event.currentTarget.querySelector('input')?.blur()
          }}
        >
          <input
            value={address ?? url}
            placeholder="输入网址或搜索"
            aria-label="网址"
            enterKeyHint="go"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            onFocus={(event) => {
              setAddress(url)
              event.currentTarget.select()
            }}
            onChange={(event) => setAddress(event.target.value)}
            onBlur={() => setAddress(null)}
          />
        </form>
        <IconButton
          icon={Keyboard}
          label="键盘"
          className={styles.keyboardButton}
          onClick={() => keyboardRef.current?.focus({ preventScroll: true })}
        />
      </header>
      <Screen onState={setState} keyboardRef={keyboardRef} />
    </div>
  )
}
