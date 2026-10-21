import { NativeSelect, OutlinedInput, TextareaAutosize } from '@mui/material'
import type { InputHTMLAttributes, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function Input({ className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return (
    <OutlinedInput
      className={className}
      inputRef={ref}
      value={props.value}
      defaultValue={props.defaultValue}
      disabled={props.disabled}
      readOnly={props.readOnly}
      type={props.type}
      slotProps={{ input: props }}
    />
  )
}

export function Textarea({
  className,
  ref,
  rows,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <TextareaAutosize className={className} ref={ref} minRows={rows} maxRows={8} {...props} />
}

export function SelectInput({
  className,
  children,
  ref,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return (
    <NativeSelect
      className={className}
      input={<OutlinedInput />}
      inputRef={ref}
      inputProps={props}
      value={props.value}
      onChange={props.onChange}
      disabled={props.disabled}
    >
      {children}
    </NativeSelect>
  )
}
