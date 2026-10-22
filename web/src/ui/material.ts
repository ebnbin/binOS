import { argbFromHex, Hct, hexFromArgb, MaterialDynamicColors, SchemeTonalSpot } from '@material/material-color-utilities'

const colors = new MaterialDynamicColors()
const roles = [
  'primary',
  'onPrimary',
  'primaryContainer',
  'onPrimaryContainer',
  'secondary',
  'onSecondary',
  'secondaryContainer',
  'onSecondaryContainer',
  'tertiary',
  'onTertiary',
  'tertiaryContainer',
  'onTertiaryContainer',
  'error',
  'onError',
  'errorContainer',
  'onErrorContainer',
  'surface',
  'surfaceDim',
  'surfaceBright',
  'onSurface',
  'onSurfaceVariant',
  'surfaceContainerLowest',
  'surfaceContainerLow',
  'surfaceContainer',
  'surfaceContainerHigh',
  'surfaceContainerHighest',
  'outline',
  'outlineVariant',
  'inverseSurface',
  'inverseOnSurface',
  'inversePrimary',
  'scrim',
] as const

const typeScale = {
  'display-large': [57, 64, 400],
  'display-medium': [45, 52, 400],
  'display-small': [36, 44, 400],
  'headline-large': [32, 40, 400],
  'headline-medium': [28, 36, 400],
  'headline-small': [24, 32, 400],
  'title-large': [22, 28, 400],
  'title-medium': [16, 24, 500],
  'title-small': [14, 20, 500],
  'body-large': [16, 24, 400],
  'body-medium': [14, 20, 400],
  'body-small': [12, 16, 400],
  'label-large': [14, 20, 500],
  'label-medium': [12, 16, 500],
  'label-small': [11, 16, 500],
} as const

export function createMaterialTheme(dark: boolean) {
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex('#6750a4')), dark, 0)
  const palette = Object.fromEntries(roles.map((role) => [role, hexFromArgb(colors[role]().getArgb(scheme))])) as Record<
    (typeof roles)[number],
    string
  >
  const variables: Record<string, string> = Object.fromEntries(
    roles.map((role) => [`--md-sys-color-${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, palette[role]]),
  )
  for (const [role, [size, height, weight]] of Object.entries(typeScale)) {
    variables[`--md-sys-typescale-${role}-size`] = `${size}px`
    variables[`--md-sys-typescale-${role}-line-height`] = `${height}px`
    variables[`--md-sys-typescale-${role}-weight`] = String(weight)
  }
  const font = 'Roboto, "Noto Sans", "PingFang SC", system-ui, sans-serif'
  Object.assign(variables, {
    '--md-ref-typeface-plain': font,
    '--md-ref-typeface-brand': font,
    '--md-ref-typeface-mono': '"Roboto Mono", "SF Mono", ui-monospace, Menlo, monospace',
    '--md-sys-shape-corner-extra-small': '4px',
    '--md-sys-shape-corner-small': '8px',
    '--md-sys-shape-corner-medium': '12px',
    '--md-sys-shape-corner-large': '16px',
    '--md-sys-shape-corner-extra-large': '28px',
    '--md-sys-shape-corner-full': '9999px',
    '--md-sys-motion-easing-standard': 'cubic-bezier(0.2, 0, 0, 1)',
    '--md-sys-motion-duration-short': '150ms',
    '--md-sys-motion-duration-medium': '300ms',
    '--md-sys-color-success': dark ? '#a6d39a' : '#386a20',
    '--md-sys-color-success-container': dark ? '#1f5108' : '#bdf2aa',
    '--md-sys-elevation-level1': '0 1px 2px #00000030, 0 1px 3px 1px #00000015',
    '--md-sys-elevation-level2': '0 1px 2px #00000030, 0 2px 6px 2px #00000015',
    '--md-sys-elevation-level3': '0 1px 3px #00000030, 0 4px 8px 3px #00000015',
  })
  return { variables, colors: palette }
}

export const materialLight = createMaterialTheme(false)
export const materialDark = createMaterialTheme(true)
