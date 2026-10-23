import '@fontsource-variable/roboto'
import '@fontsource-variable/roboto-mono'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tokens.css'
import './index.css'
import { Shell } from './shell/Shell.tsx'
import { reserveStatusBarTint } from './status-bar.ts'
import { TooltipProvider } from './ui/Tooltip.tsx'
import { followVisualViewport, preventPinchZoom } from './viewport.ts'

followVisualViewport()
preventPinchZoom()
reserveStatusBarTint()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={500}>
      <Shell />
    </TooltipProvider>
  </StrictMode>,
)
