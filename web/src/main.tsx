import { Provider } from '@react-spectrum/s2'
import { theme } from './ui/theme.ts'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Shell } from './shell/Shell.tsx'
import { reserveStatusBarTint } from './status-bar.ts'
import { followVisualViewport, preventPinchZoom } from './viewport.ts'

document.documentElement.classList.add(...theme.split(' ').filter(Boolean))

followVisualViewport()
preventPinchZoom()
reserveStatusBarTint()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider background="base" locale="zh-CN">
      <Shell />
    </Provider>
  </StrictMode>,
)
