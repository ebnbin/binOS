import { IconButton as MaterialIconButton, Tooltip } from '@mui/material'
import type { IconButtonProps } from '@mui/material'
import type { MaterialIcon } from './icons.tsx'

export function IconButton({ icon: Icon, label, ...props }: { icon: MaterialIcon; label: string } & IconButtonProps) {
  return (
    <Tooltip title={label}>
      <span style={{ display: 'inline-flex' }}>
        <MaterialIconButton type="button" aria-label={label} {...props}>
          <Icon size={22} />
        </MaterialIconButton>
      </span>
    </Tooltip>
  )
}
