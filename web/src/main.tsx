import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/adwaita-sans/400.css'
import '@fontsource/adwaita-sans/700.css'
import '@fontsource/adwaita-sans/800.css'
import '@fontsource/adwaita-mono/400.css'
import '@fontsource/adwaita-mono/700.css'
import './tokens.css'
import './index.css'
import './ui/adwaita.css'
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
