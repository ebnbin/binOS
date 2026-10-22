import type { HTMLAttributes, Ref, Key } from 'react'
import type { MdTextButton } from '@material/web/button/text-button.js'
import type { MdFilledButton } from '@material/web/button/filled-button.js'
import type { MdOutlinedButton } from '@material/web/button/outlined-button.js'
import type { MdFilledTonalButton } from '@material/web/button/filled-tonal-button.js'
import type { MdIconButton } from '@material/web/iconbutton/icon-button.js'
import type { MdFilledIconButton } from '@material/web/iconbutton/filled-icon-button.js'
import type { MdOutlinedTextField } from '@material/web/textfield/outlined-text-field.js'
import type { MdOutlinedSelect } from '@material/web/select/outlined-select.js'
import type { MdSelectOption } from '@material/web/select/select-option.js'
import type { MdCheckbox } from '@material/web/checkbox/checkbox.js'
import type { MdSlider } from '@material/web/slider/slider.js'
import type { MdMenu } from '@material/web/menu/menu.js'
import type { MdMenuItem } from '@material/web/menu/menu-item.js'
import type { MdDialog } from '@material/web/dialog/dialog.js'
import type { MdTabs } from '@material/web/tabs/tabs.js'
import type { MdPrimaryTab } from '@material/web/tabs/primary-tab.js'
import type { MdSecondaryTab } from '@material/web/tabs/secondary-tab.js'
import type { MdLinearProgress } from '@material/web/progress/linear-progress.js'
import type { MdCircularProgress } from '@material/web/progress/circular-progress.js'
import type { MdRipple } from '@material/web/ripple/ripple.js'
import type { MdFocusRing } from '@material/web/focus/md-focus-ring.js'

type MaterialElementProps<T extends HTMLElement> = HTMLAttributes<T> &
  Partial<Omit<T, keyof HTMLElement>> & {
    key?: Key
    ref?: Ref<T>
    onchange?: (event: Event) => void
    oninput?: (event: Event) => void
    onclosed?: (event: Event) => void
    onclosing?: (event: Event) => void
    oncancel?: (event: Event) => void
    onopened?: (event: Event) => void
  }

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'md-text-button': MaterialElementProps<MdTextButton>
      'md-filled-button': MaterialElementProps<MdFilledButton>
      'md-outlined-button': MaterialElementProps<MdOutlinedButton>
      'md-filled-tonal-button': MaterialElementProps<MdFilledTonalButton>
      'md-icon-button': MaterialElementProps<MdIconButton>
      'md-filled-icon-button': MaterialElementProps<MdFilledIconButton>
      'md-outlined-text-field': MaterialElementProps<MdOutlinedTextField>
      'md-outlined-select': MaterialElementProps<MdOutlinedSelect>
      'md-select-option': MaterialElementProps<MdSelectOption>
      'md-checkbox': MaterialElementProps<MdCheckbox>
      'md-slider': MaterialElementProps<MdSlider>
      'md-menu': MaterialElementProps<MdMenu>
      'md-menu-item': MaterialElementProps<MdMenuItem>
      'md-dialog': MaterialElementProps<MdDialog>
      'md-tabs': MaterialElementProps<MdTabs>
      'md-primary-tab': MaterialElementProps<MdPrimaryTab>
      'md-secondary-tab': MaterialElementProps<MdSecondaryTab>
      'md-linear-progress': MaterialElementProps<MdLinearProgress>
      'md-circular-progress': MaterialElementProps<MdCircularProgress>
      'md-ripple': MaterialElementProps<MdRipple>
      'md-focus-ring': MaterialElementProps<MdFocusRing>
    }
  }
}
