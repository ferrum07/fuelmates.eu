import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// El service worker solo en producción: en desarrollo estorba más que ayuda.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const eraPrimeraVisita = !navigator.serviceWorker.controller

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Sin service worker la app sigue funcionando, solo que sin modo offline.
    })
  })

  // Cuando se publica una versión nueva, recargar para no dejar la app a medias
  // entre el HTML viejo y los archivos nuevos.
  let recargando = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (eraPrimeraVisita || recargando) return
    recargando = true
    location.reload()
  })
}
