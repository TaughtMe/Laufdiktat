import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      // Updates werden NICHT automatisch angewendet, sondern optional über
      // den Versions-Button (Update-Benachrichtigung) bestätigt.
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'laufdiktat_icon.svg'],
      manifest: {
        name: 'Laufdiktat',
        short_name: 'Laufdiktat',
        description: 'Eine interaktive Laufdiktat-App für den Unterricht',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'laufdiktat_icon.svg',
            sizes: '1024x1024',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'laufdiktat_icon.svg',
            sizes: '1024x1024',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
})
