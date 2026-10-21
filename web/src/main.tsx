import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/material-symbols-rounded/fill.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import './index.css'
import { Theme } from './ui/Theme.tsx'
import { Shell } from './shell/Shell.tsx'
import { reserveStatusBarTint } from './status-bar.ts'
import { followVisualViewport, preventPinchZoom } from './viewport.ts'

followVisualViewport()
preventPinchZoom()
reserveStatusBarTint()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Theme>
      <Shell />
    </Theme>
  </StrictMode>,
)
