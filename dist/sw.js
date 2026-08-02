// Generado automáticamente por vite.config.js. No editar a mano.
const CACHE = 'gasolina-1785666655135'
const ARCHIVOS = [
  "./",
  "./index.html",
  "./assets/index-N3zBCqz0.js",
  "./assets/index-kTvvxoZ9.css",
  "./apple-touch-icon.png",
  "./favicon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./manifest.webmanifest"
]

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
