import { Card } from '@mui/material'
import { Spinner } from '../../ui/Spinner.tsx'
import { Suspense } from 'react'
import type { CSSProperties } from 'react'
import { widgetView } from '../../apps/definitions.ts'
import type { ApplicationDefinition } from '../../apps/types.ts'
import { ErrorBoundary } from '../../ui/ErrorBoundary.tsx'
import type { WidgetInstance } from '../desktop-items.ts'
import styles from '../Desktop.module.css'

export function WidgetHost({
  item,
  application,
  style,
  onOpen,
}: {
  item: WidgetInstance
  application: ApplicationDefinition
  style: CSSProperties
  onOpen: (applicationId: string, route?: string) => void
}) {
  const Widget = widgetView(application, item.widgetId)?.component
  if (!Widget) return null
  return (
    <Card
      tabIndex={application.mainWindow ? 0 : undefined}
      role="group"
      aria-label={`${application.name} 小组件`}
      onKeyDown={(event) => {
        if (application.mainWindow && event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) {
          event.preventDefault()
          onOpen(application.id)
        }
      }}
      className={styles.widget}
      style={style}
      data-opens-window={!!application.mainWindow}
      onClick={application.mainWindow ? () => onOpen(application.id) : undefined}
    >
      <ErrorBoundary fallback={() => <span className={styles.failed}>{application.name} 出错了</span>}>
        <Suspense fallback={<Spinner />}>
          <Widget instanceId={item.id} size={item.size} open={(route) => onOpen(application.id, route)} />
        </Suspense>
      </ErrorBoundary>
    </Card>
  )
}
