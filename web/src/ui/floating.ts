type Rect = { left: number; right: number; top: number; bottom: number }

export function placePopover(
  anchor: Rect,
  content: { width: number; height: number },
  viewport: { width: number; height: number },
  side: 'top' | 'bottom',
  align: 'start' | 'end',
) {
  const edge = 12
  const gap = 8
  const below = viewport.height - anchor.bottom - edge - gap
  const above = anchor.top - edge - gap
  const topSide = side === 'top' ? above >= content.height || above > below : below < content.height && above > below
  const maxHeight = Math.max(0, topSide ? above : below)
  const height = Math.min(content.height, maxHeight)
  return {
    left: Math.max(edge, Math.min(align === 'start' ? anchor.left : anchor.right - content.width, viewport.width - content.width - edge)),
    top: Math.max(edge, topSide ? anchor.top - height - gap : anchor.bottom + gap),
    maxHeight,
  }
}
