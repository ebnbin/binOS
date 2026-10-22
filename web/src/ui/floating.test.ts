import { expect, it } from 'vitest'
import { placePopover } from './floating.ts'

it('keeps an end-aligned menu inside a narrow viewport', () => {
  const position = placePopover(
    { left: 4, right: 40, top: 40, bottom: 72 },
    { width: 200, height: 100 },
    { width: 320, height: 600 },
    'bottom',
    'end',
  )
  expect(position.left).toBe(12)
  expect(position.top).toBe(80)
})

it('flips a menu above a trigger near the bottom edge', () => {
  const position = placePopover(
    { left: 280, right: 312, top: 540, bottom: 572 },
    { width: 200, height: 180 },
    { width: 320, height: 600 },
    'bottom',
    'end',
  )
  expect(position.left).toBe(108)
  expect(position.top).toBe(352)
})

it('constrains tall menus to the side with more space', () => {
  const position = placePopover(
    { left: 80, right: 120, top: 100, bottom: 140 },
    { width: 200, height: 900 },
    { width: 320, height: 400 },
    'top',
    'start',
  )
  expect(position.top).toBe(148)
  expect(position.maxHeight).toBe(240)
})

it('moves a preferred top popover below when space is insufficient', () => {
  const position = placePopover(
    { left: 100, right: 140, top: 8, bottom: 40 },
    { width: 150, height: 120 },
    { width: 320, height: 600 },
    'top',
    'start',
  )
  expect(position.top).toBe(48)
  expect(position.maxHeight).toBe(540)
})
