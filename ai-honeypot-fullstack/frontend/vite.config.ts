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
function assertProductionUrl(name: string, rawValue: string | undefined): string {
  const trimmed = String(rawValue ?? '').trim()
  const loopbackPattern = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])([/:]|$)/i
  const placeholderPattern =
    /example\.(com|net|org|io)|your-?domain|yourdomain|domain\.com|placeholder|change-?me|replace-?me|\.(local|test|invalid)$|^(?!https:\/\/)/i
  if (!trimmed || loopbackPattern.test(trimmed) || placeholderPattern.test(trimmed)) {
    throw new Error(
      `${name} must be set to the production HTTPS domain (e.g. https://cybersentil.online) at build time in CI. Found: ${trimmed || '(unset)'}`
    )
  }
  return trimmed.replace(/\/+$/, '')
}

const isProductionBuild = process.env.NODE_ENV === 'production'
const siteUrl = isProductionBuild
  ? assertProductionUrl('VITE_PUBLIC_SITE_URL', process.env.VITE_PUBLIC_SITE_URL)
  : (String(process.env.VITE_PUBLIC_SITE_URL || '').trim() || 'http://localhost')
if (isProductionBuild) {
  assertProductionUrl('VITE_PUBLIC_APP_URL', process.env.VITE_PUBLIC_APP_URL)
}
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
    minify: 'terser',
    sourcemap: false,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 300,
    cssCodeSplit: true,
    modulePreload: {
      resolveDependencies(_filename, deps) {
        // Avoid preloading attack-graph vendor code on public/home entry.
        return deps.filter((dep) => !dep.includes('graph-flow'))
      }
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }
          // Keep React family in ONE chunk. Splitting react/react-dom/scheduler
          // across vendor chunks causes runtime: "Cannot read properties of
          // undefined (reading 'createContext')" and a blank white page.
          if (
            /[\\/]node_modules[\\/](react|react-dom|scheduler)([\\/]|$)/.test(id) ||
            /[\\/]node_modules[\\/]react-router/.test(id) ||
            /[\\/]node_modules[\\/]@remix-run[\\/]router/.test(id)
          ) {
            return 'react-core'
          }
          // Heavy optional UI
          if (
            /[\\/]node_modules[\\/]lucide-react[\\/]/.test(id) ||
            /[\\/]node_modules[\\/]framer-motion[\\/]/.test(id)
          ) {
            return 'ui-libs'
          }
          // Graph/visualization (lazy routes only)
          if (/[\\/]node_modules[\\/]@xyflow[\\/]/.test(id)) {
            return 'graph-flow'
          }
          return 'vendor'
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      },
      mangle: {
        safari10: true
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
