/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Alignment',
        short_name: 'Alignment',
        description: 'Daily operating system.',
        start_url: '/',
        display: 'standalone',
        background_color: '#FBF7EE',
        theme_color: '#FBF7EE',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/planner/**'],
      exclude: ['src/planner/__tests__/**', 'src/planner/index.ts', 'src/planner/types.ts'],
      // The planner must stay fully tested. Remaining uncovered branches are defensive fallbacks.
      thresholds: { lines: 100, functions: 100, statements: 98, branches: 85 },
    },
  },
});
