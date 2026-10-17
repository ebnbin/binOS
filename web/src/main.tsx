import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Shell } from './shell/Shell.tsx'
import { followVisualViewport } from './viewport.ts'

followVisualViewport()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
)
