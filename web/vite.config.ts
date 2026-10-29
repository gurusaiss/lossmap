import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(), tailwind(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: { name: 'LossMap', short_name: 'LossMap', description: 'Find where your harvest loses value.', theme_color: '#14532d', background_color: '#f7f6f2', display: 'standalone', start_url: '/', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] },
      // the dashboard's heavy chunks (charts, map) are not precached: field phones never use them
      // the app only ever renders English and Telugu text, so the other Inter unicode-range subsets (cyrillic, greek, vietnamese) never
      // get requested at runtime; excluding them from precache saves phone storage without touching what actually renders
      workbox: { navigateFallback: '/index.html', navigateFallbackDenylist: [/^\/r\//], globIgnores: ['**/Charts-*.js', '**/CentreMap-*.js', '**/maplibre*', '**/inter-cyrillic*', '**/inter-greek*', '**/inter-vietnamese*'], globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
    }),
  ],
  worker: { format: 'es' },
  server: { port: 5173 },
  test: { environment: 'node' },
});
