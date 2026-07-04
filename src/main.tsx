import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme' // Theme-Klasse VOR dem Render setzen (kein Hell/Dunkel-Flash)
import App from './App.tsx'
import './pwa' // Service Worker registrieren + Update-Erkennung (Versions-Button)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
