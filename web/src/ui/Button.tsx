import { ActionButton, Button as SpectrumButton, Text } from '@react-spectrum/s2'
import { Children } from 'react'
import type { ButtonHTMLAttributes, Ref, ReactNode } from 'react'
import type { ActionButtonProps } from '@react-spectrum/s2'

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ActionButtonProps | 'onClick'> &
  Omit<ActionButtonProps, 'children'> & {
    children?: ReactNode
    ref?: Ref<HTMLButtonElement>
    appearance?: 'quiet' | 'primary' | 'secondary' | 'negative'
  }

export function Button({
  className,
  style,
  disabled,
  isDisabled,
  ref,
  children,
  size = 'M',
  appearance = 'quiet',
  type = 'button',
  ...props
}: ButtonProps) {
  const shared = {
    ...props,
    children: Children.map(children, (child) =>
      typeof child === 'string' || typeof child === 'number' ? <Text>{child}</Text> : child,
    ),
    type,
    isDisabled: disabled ?? isDisabled,
    UNSAFE_className: className,
    UNSAFE_style: style,
    ref: (value: { UNSAFE_getDOMNode(): HTMLButtonElement | null } | null) => {
      if (typeof ref === 'function') ref(value?.UNSAFE_getDOMNode() ?? null)
      else if (ref) ref.current = value?.UNSAFE_getDOMNode() ?? null
    },
  }
  return appearance === 'quiet' ? (
    <ActionButton {...shared} size={size} isQuiet />
  ) : (
    <SpectrumButton
      {...shared}
      size={size === 'XS' ? 'S' : size}
      variant={appearance === 'primary' ? 'accent' : appearance}
    />
  )
}
