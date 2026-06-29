import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// PWA-Update zuverlässig anwenden: Sobald ein neuer Service Worker die Kontrolle
// übernimmt (neuer Build via autoUpdate), die Seite einmalig neu laden, damit
// kein veralteter Cache-Stand hängen bleibt.
if ('serviceWorker' in navigator) {
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
