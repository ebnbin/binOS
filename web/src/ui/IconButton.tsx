import { Button, Tooltip } from '@fluentui/react-components'
import type { ButtonProps } from '@fluentui/react-components'
import type { FluentIcon } from '@fluentui/react-icons'

export function IconButton({ icon: Icon, label, ...props }: { icon: FluentIcon; label: string } & ButtonProps) {
  return (
    <Tooltip content={label} relationship="label">
      <Button size="small" type="button" appearance="subtle" aria-label={label} icon={<Icon fontSize={20} />} {...props} />
    </Tooltip>
  )
}
