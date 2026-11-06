import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { IconContext } from '@phosphor-icons/react'
import { WIDGET_KINDS, type WidgetKind } from '@shared/data'
import { TooltipProvider } from '@/components/ui/tooltip'
import { WidgetWindow } from '@/components/widget-window'
import { initTheme } from '@/hooks/use-theme'
import App from './App'

initTheme()

// Pop-out resource windows load this same page with ?widget=<kind>.
const requested = new URLSearchParams(window.location.search).get('widget')
const widget = WIDGET_KINDS.find((k) => k === requested) as WidgetKind | undefined

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* One icon family, one weight, everywhere. */}
    <IconContext.Provider value={{ weight: 'regular', size: 16 }}>
      <TooltipProvider>{widget ? <WidgetWindow kind={widget} /> : <App />}</TooltipProvider>
    </IconContext.Provider>
  </StrictMode>
)
