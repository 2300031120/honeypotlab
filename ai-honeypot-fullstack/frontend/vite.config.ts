import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import {
  renderLlmsTxt,
  renderRobots,
  renderSitemap,
  renderStructuredData
} from './src/utils/siteDiscovery.js'

const enablePwa = process.env.ENABLE_PWA === 'true'
const devApiTarget = process.env.VITE_DEV_API_TARGET || 'http://localhost:8001'
const siteName = process.env.VITE_PUBLIC_SITE_NAME || 'CyberSentil'
const shortName = process.env.VITE_PUBLIC_SHORT_NAME || 'CyberSentil'
const tagline = process.env.VITE_PUBLIC_TAGLINE || 'Deception-led threat detection'
const siteDescription =
  process.env.VITE_PUBLIC_SITE_DESCRIPTION ||
  'Deception-led threat detection platform for earlier attacker visibility, preserved evidence, and AI-assisted incident context.'
const siteUrl = process.env.VITE_PUBLIC_SITE_URL || 'http://localhost'
const companyName = process.env.VITE_PUBLIC_COMPANY_NAME || siteName

const structuredData = renderStructuredData({
  siteName,
  siteDescription,
  siteUrl,
  companyName
})

const replacePublicSiteHtml = () => ({
  name: 'replace-public-site-html',
  transformIndexHtml(html: string) {
    const replacements: Record<string, string> = {
      '%VITE_PUBLIC_SITE_NAME%': siteName,
      '%VITE_PUBLIC_TAGLINE%': tagline,
      '%VITE_PUBLIC_SITE_DESCRIPTION%': siteDescription,
      '%VITE_PUBLIC_SITE_URL%': siteUrl,
      '__PUBLIC_STRUCTURED_DATA__': structuredData
    }

    return Object.entries(replacements).reduce(
      (output, [token, value]) => output.split(token).join(value),
      html
    )
  }
})

const emitSiteDiscoveryAssets = () => ({
  name: 'emit-site-discovery-assets',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'robots.txt',
      source: renderRobots(siteUrl)
    })
    this.emitFile({
      type: 'asset',
      fileName: 'sitemap.xml',
      source: renderSitemap(siteUrl)
    })
    this.emitFile({
      type: 'asset',
      fileName: 'llms.txt',
      source: renderLlmsTxt({
        siteName,
        siteDescription,
        siteUrl
      })
    })
  }
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    replacePublicSiteHtml(),
    emitSiteDiscoveryAssets(),
    react(),
    ...(enablePwa
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
            manifest: {
              name: siteName,
              short_name: shortName,
              description: siteDescription,
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
    modulePreload: {
      resolveDependencies(_filename, deps) {
        // Avoid preloading attack-graph vendor code on public/home entry.
        return deps.filter((dep) => !dep.includes('graph-flow'))
      }
    },
    // Keep warnings visible for real regressions now that the heavy 3D globe vendor
    // stack is no longer part of the dashboard path.
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }
          if (
            /[\\/]node_modules[\\/]react[\\/]/.test(id) ||
            /[\\/]node_modules[\\/]react-dom[\\/]/.test(id)
          ) {
            return 'react-core'
          }
          if (/[\\/]node_modules[\\/]react-router-dom[\\/]/.test(id)) {
            return 'router'
          }
          if (/[\\/]node_modules[\\/]@xyflow[\\/]/.test(id)) {
            return 'graph-flow'
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
      },
      '/ws': {
        target: devApiTarget,
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom']
  }
})
