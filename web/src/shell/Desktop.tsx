import { ButtonBase, Typography } from '@mui/material'
import type { CSSProperties } from 'react'
import { findApplication, useApplications } from '../apps/index.ts'
import type { ApplicationDefinition } from '../apps/types.ts'
import { WidgetHost } from './hosts/WidgetHost.tsx'
import styles from './Desktop.module.css'
import { desktopItems, itemSize } from './desktop-items.ts'
import type { DesktopItem } from './desktop-items.ts'
import { column, desktopColumns, packColumn, splitColumns } from './layout.ts'

// 一栏 360 时的格子：两边 16，格子 70，间隔 16
const cell = 70
const gap = 16
const margin = (column.min - cell * 4 - gap * 3) / 2

export function Desktop({ width, onOpen }: { width: number; onOpen: (app: string, route?: string) => void }) {
  const apps = useApplications()
  const items = desktopItems(apps)
  const { count, columnWidth, scale } = desktopColumns(width)
  const sizes = items.map(itemSize)
  const starts = splitColumns(sizes, count)
  const columns = starts.map((start, index) => {
    const end = starts[index + 1] ?? items.length
    return { items: items.slice(start, end), ...packColumn(sizes.slice(start, end)) }
  })

  const vars = {
    '--column': `${columnWidth}px`,
    '--count': count,
    '--cell': `${cell * scale}px`,
    '--gap': `${gap * scale}px`,
    '--margin': `${margin * scale}px`,
  } as CSSProperties

  return (
    <div className={styles.desktop} style={vars}>
      <header className={styles.heading}>
        <Typography component="p" variant="overline" className={styles.eyebrow}>
          binOS
        </Typography>
        <Typography component="h1" variant="h1">
          工作空间
        </Typography>
        <Typography component="p" variant="body2">
          应用、对话与常用工具
        </Typography>
      </header>
      <div className={styles.columns}>
        {columns.map((column, index) => (
          <div key={index} className={styles.grid} style={{ gridTemplateRows: `repeat(${column.rows}, var(--cell))` }}>
            {column.items.map((item, itemIndex) => {
              const place = column.placements[itemIndex]
              return (
                <Entry
                  key={item.id}
                  item={item}
                  apps={apps}
                  style={{ gridArea: `${place.row + 1} / ${place.column + 1} / span ${place.height} / span ${place.width}` }}
                  onOpen={onOpen}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function Entry({
  item,
  apps,
  style,
  onOpen,
}: {
  item: DesktopItem
  apps: ApplicationDefinition[]
  style: CSSProperties
  onOpen: (app: string, route?: string) => void
}) {
  const app = findApplication(apps, item.applicationId)
  if (!app) {
    return null
  }
  if (item.kind === 'shortcut') {
    return (
      <ButtonBase type="button" className={styles.icon} style={style} aria-label={app.name} onClick={() => onOpen(app.id)}>
        <span className={styles.glyph}>
          <app.icon size={28} />
        </span>
        <span className={styles.label}>{app.name}</span>
      </ButtonBase>
    )
  }
  return <WidgetHost item={item} application={app} style={style} onOpen={onOpen} />
}
