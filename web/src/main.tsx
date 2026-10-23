import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/source-sans-3'
import '@fontsource-variable/source-code-pro'
import './tokens.css'
import './index.css'
import { Shell } from './shell/Shell.tsx'
import { reserveStatusBarTint } from './status-bar.ts'
import { followVisualViewport, preventPinchZoom } from './viewport.ts'

followVisualViewport()
preventPinchZoom()
reserveStatusBarTint()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
)
