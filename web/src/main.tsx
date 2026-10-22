import { AppTheme } from './ui/AppTheme.tsx'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Shell } from './shell/Shell.tsx'
import { reserveStatusBarTint } from './status-bar.ts'
import { followVisualViewport, preventPinchZoom } from './viewport.ts'

followVisualViewport()
preventPinchZoom()
reserveStatusBarTint()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppTheme>
      <Shell />
    </AppTheme>
  </StrictMode>,
)
