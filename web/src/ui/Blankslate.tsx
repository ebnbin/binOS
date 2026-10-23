import type { Icon } from '@primer/octicons-react'
import type { ReactNode } from 'react'
import styles from './Blankslate.module.css'

export function Blankslate({ icon: Visual, visual, heading, description, actions, size = 'default', className }: {
  icon?: Icon
  visual?: ReactNode
  heading?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  size?: 'default' | 'narrow'
  className?: string
}) {
  return (
    <div className={`${styles.blankslate} ${className ?? ''}`} data-size={size}>
      {(Visual || visual) && <span className={styles.visual}>{Visual ? <Visual size={24} /> : visual}</span>}
      {heading && <h3 className={styles.heading}>{heading}</h3>}
      {description && <p className={styles.description}>{description}</p>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
