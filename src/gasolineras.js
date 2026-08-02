// Precios reales de las gasolineras españolas, del servicio REST del
// Ministerio para la Transición Ecológica (MITECO).
//
// La API es pública, sin clave, y envía "Access-Control-Allow-Origin: *",
// así que se puede llamar directamente desde el navegador sin servidor propio.
//
// Doc: https://geoportalgasolineras.es/
import PROVINCIAS from './provincias.json'

const BASE =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes'

const CLAVE_CACHE = 'fuelmates/estaciones'
// Los precios oficiales se refrescan cada media hora; no tiene sentido
// volver a bajar 1 MB antes de eso.
const CADUCIDAD_MS = 30 * 60 * 1000

export { PROVINCIAS }

// Solo los carburantes de coche habituales. La API devuelve otros veinte
// (hidrógeno, amoniaco, biogás...) que aquí sobran.
export const COMBUSTIBLES = [
  { campo: 'Precio Gasolina 95 E5', nombre: 'Gasolina 95' },
  { campo: 'Precio Gasolina 98 E5', nombre: 'Gasolina 98' },
  { campo: 'Precio Gasoleo A', nombre: 'Diésel' },
  { campo: 'Precio Gasoleo Premium', nombre: 'Diésel premium' },
]

// La API manda los números con coma decimal ("1,669", "-3,481639").
const aNumero = (texto) => {
  const n = Number(String(texto ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Un precio de 0 significa "no lo vende", no que sea gratis.
const aPrecio = (texto) => {
  const n = aNumero(texto)
  return n !== null && n > 0 ? n : null
}

// Ojo: la longitud de España es negativa (Madrid está en -3,48), así que
// las coordenadas no pueden pasar por el filtro de "mayor que cero".
const aCoordenada = aNumero

export function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const rad = (grados) => (grados * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Provincia cuyo centro cae más cerca de unas coordenadas. */
export function provinciaMasCercana(lat, lon) {
  let mejor = null
  let menor = Infinity
  for (const p of PROVINCIAS) {
    const d = distanciaKm(lat, lon, p.lat, p.lon)
    if (d < menor) {
      menor = d
      mejor = p
    }
  }
  return mejor
}

/** Posición del dispositivo. Requiere HTTPS y permiso del usuario. */
export function ubicacionActual() {
  return new Promise((resolver, rechazar) => {
    if (!navigator.geolocation) {
      rechazar(new Error('Este navegador no puede darme la ubicación.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolver({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => {
        const mensajes = {
          1: 'No has dado permiso para usar la ubicación.',
          2: 'No se ha podido determinar dónde estás.',
          3: 'La ubicación ha tardado demasiado.',
        }
        rechazar(new Error(mensajes[err.code] ?? 'No se ha podido ubicarte.'))
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    )
  })
}

/** Se queda solo con lo que la app usa: la respuesta cruda trae 40 campos. */
function normalizar(cruda) {
  const precios = {}
  for (const { campo } of COMBUSTIBLES) {
    const precio = aPrecio(cruda[campo])
    if (precio !== null) precios[campo] = precio
  }
  if (Object.keys(precios).length === 0) return null // no vende nada nuestro

  return {
    id: cruda.IDEESS,
    rotulo: cruda['Rótulo'] || 'Sin rótulo',
    direccion: cruda['Dirección'] || '',
    municipio: cruda.Municipio || cruda.Localidad || '',
    horario: cruda.Horario || '',
    lat: aCoordenada(cruda.Latitud),
    lon: aCoordenada(cruda['Longitud (WGS84)']),
    precios,
  }
}

function leerCache(idProvincia) {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_CACHE))
    if (!guardado || guardado.idProvincia !== idProvincia) return null
    if (Date.now() - guardado.guardadoEn > CADUCIDAD_MS) return null
    return guardado
  } catch {
    return null
  }
}

/**
 * Estaciones de una provincia. Nunca se piden las 11.482 de España: son
 * 11,6 MB y siete segundos. Por provincia baja a ~1 MB y un segundo.
 */
export async function cargarEstaciones(idProvincia) {
  const cacheada = leerCache(idProvincia)
  if (cacheada) return { ...cacheada, deCache: true }

  // Sin esto, una red que no responde deja la app cargando para siempre.
  const corte = new AbortController()
  const temporizador = setTimeout(() => corte.abort(), 15000)

  let respuesta
  try {
    respuesta = await fetch(
      `${BASE}/EstacionesTerrestres/FiltroProvincia/${idProvincia}`,
      { signal: corte.signal }
    )
  } catch {
    throw new Error('No se ha podido conectar. ¿Tienes cobertura?')
  } finally {
    clearTimeout(temporizador)
  }

  if (!respuesta.ok) {
    throw new Error(`El servicio del Ministerio ha fallado (${respuesta.status}).`)
  }

  const datos = await respuesta.json()
  const estaciones = (datos.ListaEESSPrecio ?? [])
    .map(normalizar)
    .filter((e) => e !== null && e.lat !== null && e.lon !== null)

  const resultado = {
    idProvincia,
    fecha: datos.Fecha ?? '',
    guardadoEn: Date.now(),
    estaciones,
  }

  try {
    localStorage.setItem(CLAVE_CACHE, JSON.stringify(resultado))
  } catch {
    // Si no cabe en localStorage da igual: seguimos con los datos en memoria.
  }

  return { ...resultado, deCache: false }
}

/** Ordena por cercanía si sabemos dónde estamos; si no, por municipio. */
export function ordenar(estaciones, posicion, campoCombustible) {
  const conPrecio = estaciones.filter((e) => e.precios[campoCombustible] != null)

  if (!posicion) {
    return conPrecio
      .map((e) => ({ ...e, distancia: null }))
      .sort((a, b) => a.municipio.localeCompare(b.municipio, 'es'))
  }

  return conPrecio
    .map((e) => ({
      ...e,
      distancia: distanciaKm(posicion.lat, posicion.lon, e.lat, e.lon),
    }))
    .sort((a, b) => a.distancia - b.distancia)
}
