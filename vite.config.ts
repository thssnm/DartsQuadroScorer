import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Versionsnummer zur Buildzeit aus der package.json einbetten - die App hat
// kein Backend, das sie zur Laufzeit liefern könnte.
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
) as { version: string }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Quadro Darts Scorer',
        short_name: 'Quadro Darts Scorer',
        description: '501 Double-Out Scoring App für das Harrows Quadro Board',
        theme_color: '#a01818',
        background_color: '#1a1a1e',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
})
