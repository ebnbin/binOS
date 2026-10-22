import { argbFromHex, Contrast, lstarFromArgb } from '@material/material-color-utilities'
import { describe, expect, it } from 'vitest'
import { materialDark, materialLight } from './material.ts'

for (const [name, material] of [
  ['light', materialLight],
  ['dark', materialDark],
] as const) {
  describe(`${name} Material text contrast`, () => {
    it('keeps text readable on accent and container surfaces', () => {
      const pairs = [
        ['primary', 'onPrimary'],
        ['primaryContainer', 'onPrimaryContainer'],
        ['secondary', 'onSecondary'],
        ['secondaryContainer', 'onSecondaryContainer'],
        ['tertiary', 'onTertiary'],
        ['tertiaryContainer', 'onTertiaryContainer'],
        ['error', 'onError'],
        ['errorContainer', 'onErrorContainer'],
        ['surface', 'onSurface'],
        ['surfaceContainerLowest', 'onSurface'],
        ['surfaceContainerLow', 'onSurface'],
        ['surfaceContainer', 'onSurfaceVariant'],
        ['surfaceContainerHigh', 'onSurface'],
        ['surfaceContainerHighest', 'onSurface'],
        ['inverseSurface', 'inverseOnSurface'],
      ] as const
      for (const [background, foreground] of pairs) {
        const ratio = Contrast.ratioOfTones(
          lstarFromArgb(argbFromHex(material.colors[background])),
          lstarFromArgb(argbFromHex(material.colors[foreground])),
        )
        expect(ratio, `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5)
      }
    })
  })
}
