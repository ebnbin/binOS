import { Button, Text } from '@radix-ui/themes'
import { Suspense, useMemo } from 'react'
import { findApplication, useApplications, windowView } from '../../apps/index.ts'
import type { WindowContext } from '../../apps/types.ts'
import { ErrorBoundary } from '../../ui/ErrorBoundary.tsx'
import styles from './WindowHost.module.css'
import { createWindowContext } from '../controller/navigation.ts'
import type { WindowInstance } from '../state/types.ts'

// 一个窗口里的 app。出错时只影响这个窗口
export function WindowHost({ window: win, onTitle, onOpen }: { window: WindowInstance; onOpen?: WindowContext['openApplication']; onTitle: (id: string, title: string) => void }) {
  const { id, route } = win
  const apps = useApplications()
  const ctx = useMemo<WindowContext>(() => createWindowContext(id, route, onTitle, onOpen), [id, route, onTitle, onOpen])

  const App = windowView(findApplication(apps, win.applicationId), win.viewId)?.component
  if (!App) {
    return <div className={styles.message}><Text size="2" color="gray">找不到 app「{win.applicationId}」</Text></div>
  }
  return (
    <ErrorBoundary
      fallback={(retry) => (
        <div className={styles.message}>
          <Text size="2" color="gray">这个 app 出错了</Text>
          <Button variant="soft" color="gray" onClick={retry}>
            重新打开
          </Button>
        </div>
      )}
    >
      <Suspense>
        <App ctx={ctx} />
      </Suspense>
    </ErrorBoundary>
  )
}
