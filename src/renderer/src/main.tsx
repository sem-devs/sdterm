import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { IconContext } from '@phosphor-icons/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { initTheme } from '@/hooks/use-theme'
import App from './App'

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* One icon family, one weight, everywhere. */}
    <IconContext.Provider value={{ weight: 'regular', size: 16 }}>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </IconContext.Provider>
  </StrictMode>
)
