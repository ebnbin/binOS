import '@material/web/select/outlined-select.js'
import '@material/web/select/select-option.js'
import type { MdOutlinedSelect } from '@material/web/select/outlined-select.js'
import { useLayoutEffect, useRef } from 'react'
import { useReducedMotion } from './useReducedMotion.ts'
import styles from './Select.module.css'

type Option = { value: string; label: string; disabled?: boolean }

export function Select({
  value,
  options,
  onValueChange,
  label,
  title,
  disabled,
  className,
}: {
  value: string
  options: Option[]
  onValueChange: (value: string) => void
  label: string
  title?: string
  disabled?: boolean
  className?: string
}) {
  const quick = useReducedMotion()
  const select = useRef<MdOutlinedSelect>(null)
  useLayoutEffect(() => {
    const element = select.current
    let active = true
    void element?.updateComplete.then(() => {
      if (active) element.value = value
    })
    return () => {
      active = false
    }
  }, [value, options])
  return (
    <md-outlined-select
      ref={select}
      quick={quick}
      className={`${styles.control} ${className ?? ''}`}
      label={label}
      aria-label={label}
      title={title}
      value={value}
      disabled={disabled ?? false}
      menuPositioning="popover"
      onchange={(event) => onValueChange((event.currentTarget as MdOutlinedSelect).value)}
    >
      {options.map((option) => (
        <md-select-option key={option.value} value={option.value} selected={option.value === value} disabled={option.disabled ?? false}>
          <div slot="headline">{option.label}</div>
        </md-select-option>
      ))}
    </md-outlined-select>
  )
}
