export type Position = { x: number; y: number }
export type Dimensions = { width: number; height: number }
const margin = 12

export function restorePosition(value: unknown): Position {
  const position = value as Position | null
  return position && Number.isFinite(position.x) && Number.isFinite(position.y)
    ? { x: Math.max(0, Math.min(1, position.x)), y: Math.max(0, Math.min(1, position.y)) }
    : { x: 1, y: 1 }
}
export function floatingBounds(screen: Dimensions, panel: Dimensions) {
  return { x: Math.max(0, screen.width - panel.width - margin * 2), y: Math.max(0, screen.height - panel.height - margin * 2) }
}
export function floatingOffset(position: Position, bounds: Position): Position {
  return { x: margin + position.x * bounds.x, y: margin + position.y * bounds.y }
}
export function moveFloating(position: Position, delta: Position, bounds: Position): Position {
  return { x: bounds.x ? Math.max(0, Math.min(1, position.x + delta.x / bounds.x)) : 0, y: bounds.y ? Math.max(0, Math.min(1, position.y + delta.y / bounds.y)) : 0 }
}
