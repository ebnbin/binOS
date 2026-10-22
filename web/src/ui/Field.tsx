import { style as spectrumStyle } from '@react-spectrum/s2/style' with { type: 'macro' }
import { TextArea, TextField } from '@react-spectrum/s2'
import type { TextFieldRef, TextAreaProps, TextFieldProps } from '@react-spectrum/s2'
import type { InputHTMLAttributes, TextareaHTMLAttributes, Ref, FocusEvent, KeyboardEvent } from 'react'

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> & {
  onValueChange?: (value: string) => void
  ref?: Ref<HTMLInputElement>
}
type AreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & {
  onValueChange?: (value: string) => void
  ref?: Ref<HTMLTextAreaElement>
}

function assign<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value)
  else if (ref) ref.current = value
}

export function Field({
  ref,
  className,
  style,
  disabled,
  readOnly,
  required,
  onValueChange,
  onFocus,
  onBlur,
  onKeyDown,
  onKeyUp,
  value,
  defaultValue,
  'aria-invalid': invalid,
  spellCheck,
  ...props
}: InputProps) {
  return (
    <TextField
      {...(props as TextFieldProps)}
      spellCheck={spellCheck === undefined ? undefined : String(spellCheck)}
      styles={spectrumStyle({ width: 'full', minWidth: 0, flexGrow: 1 })}
      UNSAFE_className={className}
      UNSAFE_style={style}
      isDisabled={disabled}
      isReadOnly={readOnly}
      isRequired={required}
      isInvalid={invalid === true || invalid === 'true'}
      value={value === undefined ? undefined : String(value)}
      defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
      onChange={onValueChange}
      ref={(node: TextFieldRef | null) => assign(ref, node?.getInputElement() ?? null)}
      onFocus={(event) => onFocus?.(event as FocusEvent<HTMLInputElement>)}
      onBlur={(event) => onBlur?.(event as FocusEvent<HTMLInputElement>)}
      onKeyDown={
        onKeyDown
          ? (event) => {
              onKeyDown(event as KeyboardEvent<HTMLInputElement>)
              if (!event.isDefaultPrevented()) event.continuePropagation()
            }
          : undefined
      }
      onKeyUp={
        onKeyUp
          ? (event) => {
              onKeyUp(event as KeyboardEvent<HTMLInputElement>)
              if (!event.isDefaultPrevented()) event.continuePropagation()
            }
          : undefined
      }
    />
  )
}

export function Area({
  ref,
  className,
  style,
  disabled,
  readOnly,
  required,
  onValueChange,
  onFocus,
  onBlur,
  onKeyDown,
  onKeyUp,
  onPaste,
  value,
  defaultValue,
  rows: _rows,
  ...props
}: AreaProps) {
  return (
    <span
      className="spectrum-area"
      onPaste={(event) => onPaste?.(event as unknown as import('react').ClipboardEvent<HTMLTextAreaElement>)}
    >
      <TextArea
        {...(props as unknown as TextAreaProps)}
        styles={spectrumStyle({ width: 'full', minWidth: 0, flexGrow: 1 })}
        UNSAFE_className={className}
        UNSAFE_style={style}
        isDisabled={disabled}
        isReadOnly={readOnly}
        isRequired={required}
        value={value === undefined ? undefined : String(value)}
        defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
        onChange={onValueChange}
        ref={(node: TextFieldRef<HTMLTextAreaElement> | null) => assign(ref, node?.getInputElement() ?? null)}
        onFocus={(event) => onFocus?.(event as unknown as FocusEvent<HTMLTextAreaElement>)}
        onBlur={(event) => onBlur?.(event as unknown as FocusEvent<HTMLTextAreaElement>)}
        onKeyDown={
          onKeyDown
            ? (event) => {
                onKeyDown(event as KeyboardEvent<HTMLTextAreaElement>)
                if (!event.isDefaultPrevented()) event.continuePropagation()
              }
            : undefined
        }
        onKeyUp={
          onKeyUp
            ? (event) => {
                onKeyUp(event as KeyboardEvent<HTMLTextAreaElement>)
                if (!event.isDefaultPrevented()) event.continuePropagation()
              }
            : undefined
        }
      />
    </span>
  )
}
