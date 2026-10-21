import { argbFromHex, Hct, hexFromArgb, MaterialDynamicColors, SchemeTonalSpot } from '@material/material-color-utilities'
import { createTheme } from '@mui/material/styles'

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
  const typography = (role: keyof typeof typeScale) => {
    const [size, height, weight] = typeScale[role]
    return { fontFamily: font, fontSize: `${size}px`, lineHeight: `${height}px`, fontWeight: weight }
  }
  const hover = (role: string) => `color-mix(in srgb, ${role} 8%, transparent)`
  const selected = { backgroundColor: palette.secondaryContainer, color: palette.onSecondaryContainer }
  const theme = createTheme({
    palette: {
      mode: dark ? 'dark' : 'light',
      primary: { main: palette.primary, contrastText: palette.onPrimary },
      secondary: { main: palette.secondary, contrastText: palette.onSecondary },
      error: { main: palette.error, contrastText: palette.onError },
      warning: { main: palette.tertiary, contrastText: palette.onTertiary },
      background: { default: palette.surface, paper: palette.surfaceContainerLow },
      text: { primary: palette.onSurface, secondary: palette.onSurfaceVariant },
      divider: palette.outlineVariant,
      action: {
        hover: hover(palette.onSurface),
        selected: palette.secondaryContainer,
        focus: `color-mix(in srgb, ${palette.onSurface} 12%, transparent)`,
      },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: font,
      h1: typography('headline-large'),
      h2: typography('headline-medium'),
      h3: typography('headline-small'),
      h4: typography('title-large'),
      h5: typography('title-medium'),
      h6: typography('title-small'),
      body1: typography('body-large'),
      body2: typography('body-medium'),
      subtitle1: typography('title-medium'),
      subtitle2: typography('title-small'),
      caption: typography('body-small'),
      overline: typography('label-small'),
      button: { ...typography('label-large'), textTransform: 'none', letterSpacing: '0.1px' },
    },
    transitions: { easing: { easeInOut: 'cubic-bezier(0.2, 0, 0, 1)' }, duration: { standard: 300, short: 200, shorter: 150 } },
    components: {
      MuiCssBaseline: { styleOverrides: { ':root': { ...variables, colorScheme: dark ? 'dark' : 'light' }, body: { background: '#000' } } },
      MuiButtonBase: {
        styleOverrides: {
          root: {
            '&:not(.MuiButton-root):not(.MuiIconButton-root):not(.MuiTab-root):hover': { backgroundColor: hover(palette.onSurface) },
            '&[aria-pressed="true"], &[aria-current="page"]': selected,
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 9999,
            minHeight: 40,
            padding: '8px 24px',
            gap: 8,
            '&.MuiButton-sizeSmall': { minHeight: 32, padding: '6px 16px' },
            '&.MuiButton-outlined': { borderColor: palette.outline },
            '&[aria-pressed="true"], &[aria-current="page"], &[data-active="true"]': selected,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            width: 40,
            height: 40,
            color: palette.onSurfaceVariant,
            '&[aria-pressed="true"], &[aria-expanded="true"]': selected,
            '&.MuiIconButton-sizeSmall': { width: 32, height: 32 },
          },
        },
      },
      MuiFab: {
        defaultProps: { color: 'secondary' },
        styleOverrides: {
          root: {
            borderRadius: 16,
            background: palette.primaryContainer,
            color: palette.onPrimaryContainer,
            boxShadow: variables['--md-sys-elevation-level3'],
            '&:hover': { background: `color-mix(in srgb, ${palette.onPrimaryContainer} 8%, ${palette.primaryContainer})` },
          },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' }, rounded: { borderRadius: 16 } } },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { borderRadius: 16, backgroundColor: palette.surfaceContainerLow } },
      },
      MuiDialog: {
        defaultProps: { maxWidth: false },
        styleOverrides: {
          paper: { borderRadius: 28, backgroundColor: palette.surfaceContainerHigh, boxShadow: variables['--md-sys-elevation-level3'] },
        },
      },
      MuiDialogTitle: { styleOverrides: { root: typography('headline-small') } },
      MuiDialogContent: { styleOverrides: { root: typography('body-medium') } },
      MuiPopover: {
        styleOverrides: {
          paper: { borderRadius: 16, backgroundColor: palette.surfaceContainer, boxShadow: variables['--md-sys-elevation-level2'] },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: { borderRadius: 8, backgroundColor: palette.surfaceContainer, boxShadow: variables['--md-sys-elevation-level2'] },
        },
      },
      MuiMenuItem: { styleOverrides: { root: { minHeight: 48, ...typography('body-large'), gap: 12, '&.Mui-selected': selected } } },
      MuiOutlinedInput: {
        defaultProps: { size: 'small' },
        styleOverrides: {
          root: {
            borderRadius: 4,
            minHeight: 40,
            backgroundColor: 'transparent',
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: palette.onSurface },
          },
          notchedOutline: { borderColor: palette.outline },
          input: { padding: '10px 12px', ...typography('body-medium') },
        },
      },
      MuiFilledInput: {
        styleOverrides: { root: { backgroundColor: palette.surfaceContainerHighest, borderTopLeftRadius: 4, borderTopRightRadius: 4 } },
      },
      MuiSelect: { defaultProps: { size: 'small' }, styleOverrides: { select: { ...typography('body-medium') } } },
      MuiCheckbox: { styleOverrides: { root: { padding: 10 } } },
      MuiFormControlLabel: { styleOverrides: { label: typography('body-medium') } },
      MuiTabs: { styleOverrides: { root: { minHeight: 48 }, indicator: { height: 3, borderRadius: '3px 3px 0 0' } } },
      MuiTab: { styleOverrides: { root: { textTransform: 'none', minHeight: 48, ...typography('title-small') } } },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 9999,
            minHeight: 48,
            padding: '8px 16px',
            '&.Mui-selected': selected,
            '&.Mui-selected:hover': {
              backgroundColor: `color-mix(in srgb, ${palette.onSecondaryContainer} 8%, ${palette.secondaryContainer})`,
            },
          },
        },
      },
      MuiListItemIcon: { styleOverrides: { root: { minWidth: 40, color: 'inherit' } } },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 8, ...typography('label-large') },
          colorPrimary: { backgroundColor: palette.primaryContainer, color: palette.onPrimaryContainer },
          colorSecondary: { backgroundColor: palette.secondaryContainer, color: palette.onSecondaryContainer },
        },
      },
      MuiAlert: {
        defaultProps: { variant: 'standard' },
        styleOverrides: {
          root: {
            borderRadius: 12,
            alignItems: 'center',
            ...typography('body-medium'),
            '&.MuiAlert-standard.MuiAlert-colorError': { backgroundColor: palette.errorContainer, color: palette.onErrorContainer },
            '&.MuiAlert-standard.MuiAlert-colorInfo': { backgroundColor: palette.secondaryContainer, color: palette.onSecondaryContainer },
            '&.MuiAlert-standard.MuiAlert-colorWarning': { backgroundColor: palette.tertiaryContainer, color: palette.onTertiaryContainer },
          },
        },
      },
      MuiSlider: {
        styleOverrides: {
          root: { height: 8 },
          rail: { opacity: 1, backgroundColor: palette.surfaceContainerHighest },
          thumb: { width: 4, height: 32, borderRadius: 2, boxShadow: 'none' },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { height: 4, borderRadius: 9999, backgroundColor: palette.secondaryContainer },
          bar: { borderRadius: 9999 },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: palette.inverseSurface,
            color: palette.inverseOnSurface,
            borderRadius: 4,
            ...typography('body-small'),
          },
        },
      },
    },
  })
  return { theme, colors: palette }
}

export const materialLight = createMaterialTheme(false)
export const materialDark = createMaterialTheme(true)
