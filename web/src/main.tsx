import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@radix-ui/themes/styles.css'
import './tokens.css'
import './index.css'
import { Shell } from './shell/Shell.tsx'
import { SystemTheme } from './ui/theme.tsx'
import { reserveStatusBarTint } from './status-bar.ts'
import { followVisualViewport, preventPinchZoom } from './viewport.ts'

followVisualViewport()
preventPinchZoom()
reserveStatusBarTint()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemTheme>
      <Shell />
    </SystemTheme>
  </StrictMode>,
)
