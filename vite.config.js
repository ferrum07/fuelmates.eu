import { readdirSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Genera el service worker en cada build con la lista real de archivos
 * (los nombres llevan hash, así que no se puede escribir a mano).
 * Rutas relativas para que funcione también en un subdirectorio.
 */
function serviceWorker() {
  return {
    name: 'service-worker-precache',
    apply: 'build',
    generateBundle(_opciones, paquete) {
      const delBuild = Object.keys(paquete)
      // Solo archivos con extensión: CNAME y compañía son configuración del
      // hosting, no recursos de la app. Y si uno solo de la lista falla al
      // descargarse, cache.addAll falla entero y no habría modo offline.
      const dePublic = readdirSync('public').filter((f) => f.includes('.'))
      // index.html lo emite Vite después que este plugin, así que va a mano.
      const archivos = [
        ...new Set([
          './',
          './index.html',
          ...[...delBuild, ...dePublic].map((f) => './' + f),
        ]),
      ]
      const version = Date.now()

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `// Generado automáticamente por vite.config.js. No editar a mano.
const CACHE = 'gasolina-${version}'
const ARCHIVOS = ${JSON.stringify(archivos, null, 2)}

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request
  if (peticion.method !== 'GET') return
  if (new URL(peticion.url).origin !== self.location.origin) return

  // Al abrir la app: red primero para recibir actualizaciones,
  // y si no hay cobertura, la copia guardada.
  if (peticion.mode === 'navigate') {
    evento.respondWith(
      fetch(peticion).catch(async () => {
        const cache = await caches.open(CACHE)
        return (
          (await cache.match('./index.html')) ||
          (await cache.match('./')) ||
          Response.error()
        )
      })
    )
    return
  }

  // El resto (JS, CSS, iconos): cache primero, y se refresca por detrás.
  evento.respondWith(
    caches.match(peticion, { ignoreSearch: true }).then((guardada) => {
      const desdeRed = fetch(peticion)
        .then((respuesta) => {
          if (respuesta.ok) {
            const copia = respuesta.clone()
            caches.open(CACHE).then((cache) => cache.put(peticion, copia))
          }
          return respuesta
        })
        .catch(() => guardada)
      return guardada || desdeRed
    })
  )
})
`,
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  server: { port: 5173 },
  // Rutas relativas: la app funciona igual en la raíz de un dominio que en
  // un subdirectorio como usuario.github.io/lo-que-sea/, sin tocar nada.
  base: './',
})
