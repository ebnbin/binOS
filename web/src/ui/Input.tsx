import '@material/web/textfield/outlined-text-field.js'
import '@material/web/slider/slider.js'
import { useLayoutEffect, useRef } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes, Ref, ChangeEvent, SyntheticEvent } from 'react'
import type { MdOutlinedTextField } from '@material/web/textfield/outlined-text-field.js'
import styles from './Input.module.css'

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') return ref(value)
  if (ref) ref.current = value
}

function retarget<T extends HTMLElement, E extends Event | SyntheticEvent>(event: E, element: T) {
  return new Proxy(event, {
    get(source, key) {
      if (key === 'target' || key === 'currentTarget') return element
      if (key === 'nativeEvent') return 'nativeEvent' in source ? source.nativeEvent : source
      const value = Reflect.get(source, key)
      return typeof value === 'function' ? value.bind(source) : value
    },
  })
}

type FieldProps<T extends HTMLInputElement | HTMLTextAreaElement> = InputHTMLAttributes<T> & {
  ref?: Ref<T>
  multiline?: boolean
  rows?: number
}

function TextField<T extends HTMLInputElement | HTMLTextAreaElement>({
  ref,
  multiline,
  rows,
  className,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  onKeyUp,
  onPaste,
  autoFocus,
  value,
  defaultValue,
  ...props
}: FieldProps<T>) {
  const field = useRef<MdOutlinedTextField>(null)
  const label = props['aria-label']
  useLayoutEffect(() => {
    let active = true
    const element = field.current
    void element?.updateComplete.then(() => {
      if (!active) return
      const input = element.shadowRoot?.querySelector<T>(multiline ? 'textarea' : 'input')
      if (!input) return
      if (!label) {
        const caption = element.closest('label')?.querySelector('span')?.textContent
        if (caption) element.label = caption
      }
      if (multiline) {
        input.style.fieldSizing = 'content'
        input.style.maxHeight = '200px'
        input.style.resize = 'none'
      }
      assignRef(ref, input)
      if (autoFocus) input.focus()
    })
    return () => {
      active = false
      assignRef(ref, null)
    }
  }, [ref, autoFocus, multiline, label])
  const native = () => field.current?.shadowRoot?.querySelector<T>(multiline ? 'textarea' : 'input')
  return (
    <md-outlined-text-field
      ref={field}
      className={`${styles.field} ${className ?? ''}`}
      type={multiline ? 'textarea' : ((props.type as MdOutlinedTextField['type']) ?? 'text')}
      value={value === undefined ? String(defaultValue ?? '') : String(value)}
      label={props['aria-label'] ?? props.placeholder ?? ''}
      aria-label={props['aria-label']}
      aria-invalid={props['aria-invalid']}
      aria-busy={props['aria-busy']}
      name={props.name ?? ''}
      disabled={props.disabled ?? false}
      readOnly={props.readOnly ?? false}
      required={props.required ?? false}
      maxLength={props.maxLength ?? -1}
      minLength={props.minLength ?? -1}
      pattern={props.pattern ?? ''}
      placeholder={props.placeholder ?? ''}
      autocomplete={props.autoComplete ?? ''}
      inputMode={props.inputMode}
      spellCheck={props.spellCheck}
      autoFocus={autoFocus}
      rows={rows ?? 1}
      oninput={(event) => {
        const input = native()
        if (input) onChange?.(retarget(event, input) as unknown as ChangeEvent<T>)
      }}
      onFocus={(event) => {
        const input = native()
        if (input) onFocus?.(retarget(event, input) as unknown as React.FocusEvent<T>)
      }}
      onBlur={(event) => {
        const input = native()
        if (input) onBlur?.(retarget(event, input) as unknown as React.FocusEvent<T>)
      }}
      onKeyDown={(event) => {
        const input = native()
        if (input) onKeyDown?.(retarget(event, input) as unknown as React.KeyboardEvent<T>)
      }}
      onKeyUp={(event) => {
        const input = native()
        if (input) onKeyUp?.(retarget(event, input) as unknown as React.KeyboardEvent<T>)
      }}
      onPaste={(event) => {
        const input = native()
        if (input) onPaste?.(retarget(event, input) as unknown as React.ClipboardEvent<T>)
      }}
    />
  )
}

export function Input({ ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  if (props.type === 'file' || props.type === 'hidden') return <input ref={ref} {...props} />
  if (props.type === 'range')
    return (
      <md-slider
        className={props.className}
        aria-label={props['aria-label']}
        min={Number(props.min ?? 0)}
        max={Number(props.max ?? 100)}
        step={Number(props.step ?? 1)}
        value={Number(props.value ?? 0)}
        disabled={props.disabled ?? false}
        oninput={(event) => {
          const element = event.currentTarget as HTMLElement & { value: number }
          const input = element.shadowRoot?.querySelector('input')
          if (!input) return
          props.onChange?.(retarget(event, input) as unknown as ChangeEvent<HTMLInputElement>)
        }}
      />
    )
  return <TextField {...props} ref={ref} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <TextField<HTMLTextAreaElement> {...props} multiline />
}
