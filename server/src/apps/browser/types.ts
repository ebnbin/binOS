export type TabState = {
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

// width、height 是页面的 CSS 像素尺寸，data 是 base64 的 JPEG
export type BrowserEvent = { type: 'state'; state: TabState } | { type: 'frame'; data: string; width: number; height: number }

// 坐标都是页面的 CSS 像素。modifiers 按 CDP 的约定：Alt 1、Ctrl 2、Meta 4、Shift 8
export type InputEvent =
  | {
      type: 'mouse'
      action: 'down' | 'up' | 'move'
      x: number
      y: number
      button: 'none' | 'left' | 'middle' | 'right'
      clickCount: number
      modifiers: number
    }
  | { type: 'wheel'; x: number; y: number; deltaX: number; deltaY: number; modifiers: number }
  | { type: 'key'; action: 'down' | 'up'; key: string; code: string; keyCode: number; text?: string; modifiers: number }
  | { type: 'text'; text: string }

export type Viewport = { width: number; height: number; scale: number }

export type TabAction = 'back' | 'forward' | 'reload' | 'stop'
