import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'katex/dist/katex.min.css' // Für MathDisplay (Brüche/Potenzen/Wurzeln, siehe components/shared/MathDisplay.tsx)
import './theme' // Theme-Klasse VOR dem Render setzen (kein Hell/Dunkel-Flash)
import App from './App.tsx'
import './pwa' // Service Worker registrieren + Update-Erkennung (Versions-Button)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
