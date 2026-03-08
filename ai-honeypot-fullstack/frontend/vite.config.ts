import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const enablePwa = process.env.ENABLE_PWA === 'true'
const devApiTarget = process.env.VITE_DEV_API_TARGET || 'http://localhost:8000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ...(enablePwa
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
            manifest: {
              name: 'CyberSentinel AI - Neural Defense Platform',
              short_name: 'CyberSentinel',
              description: 'Advanced AI-powered honeypot and threat detection platform',
              theme_color: '#010409',
              background_color: '#010409',
              display: 'standalone',
              orientation: 'portrait-primary',
              scope: '/',
              start_url: '/',
              icons: [
                {
                  src: 'pwa-192x192.png',
                  sizes: '192x192',
                  type: 'image/png'
                },
                {
                  src: 'pwa-512x512.png',
                  sizes: '512x512',
                  type: 'image/png'
                }
              ]
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/api\.*/,
                  handler: 'NetworkFirst',
                  options: {
                    cacheName: 'api-cache',
                    expiration: {
                      maxEntries: 100,
                      maxAgeSeconds: 60 * 60 * 24 // 24 hours
                    }
                  }
                }
              ]
            }
          })
        ]
      : [])
  ],
  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: true,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }
          if (id.includes('/react/') || id.includes('/react-dom/')) {
            return 'react-core'
          }
          if (id.includes('/react-router-dom/')) {
            return 'router'
          }
          if (id.includes('react-globe.gl')) {
            return 'globe-viz'
          }
          if (id.includes('/three/')) {
            return 'three-core'
          }
          if (id.includes('/@xyflow/')) {
            return 'graph-flow'
          }
          if (id.includes('/d3-') || id.includes('/d3/')) {
            return 'd3-core'
          }
          if (id.includes('/recharts/')) {
            return 'charts'
          }
          if (id.includes('/jspdf/') || id.includes('/jspdf-autotable/')) {
            return 'pdf'
          }
          if (id.includes('/framer-motion/')) {
            return 'motion'
          }
          return undefined
        }
      }
    }
  },
  server: {
    host: true,
    port: 5173,
    cors: true,
    proxy: {
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', 'three']
  }
})
