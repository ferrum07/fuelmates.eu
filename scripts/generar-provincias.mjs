// Descarga una vez el listado completo de gasolineras y calcula el centro
// aproximado de cada provincia (la mediana de las coordenadas de sus
// estaciones, más robusta que la media ante datos sueltos mal puestos).
//
// Con esa tabla, la app traduce las coordenadas del GPS a una provincia sin
// llamar a ningún servicio de geocodificación: busca el centro más cercano.
// El usuario siempre puede corregir la provincia a mano.
//
//   node scripts/generar-provincias.mjs
import { writeFileSync } from 'node:fs'

const BASE =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes'

const num = (s) => Number(String(s ?? '').replace(',', '.'))

const mediana = (valores) => {
  const orden = [...valores].sort((a, b) => a - b)
  const medio = Math.floor(orden.length / 2)
  return orden.length % 2
    ? orden[medio]
    : (orden[medio - 1] + orden[medio]) / 2
}

console.log('Descargando el listado completo (unos 11 MB, tarda)...')
const datos = await fetch(`${BASE}/EstacionesTerrestres/`).then((r) => r.json())
const estaciones = datos.ListaEESSPrecio

const porProvincia = new Map()
for (const e of estaciones) {
  const id = e.IDProvincia
  const lat = num(e.Latitud)
  const lon = num(e['Longitud (WGS84)'])
  if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
  if (!porProvincia.has(id)) {
    porProvincia.set(id, { id, nombre: e.Provincia, lats: [], lons: [] })
  }
  const p = porProvincia.get(id)
  p.lats.push(lat)
  p.lons.push(lon)
}

const provincias = [...porProvincia.values()]
  .map((p) => ({
    id: p.id,
    nombre: p.nombre,
    // Redondeado a 3 decimales: ~100 m de precisión, de sobra para
    // decidir en qué provincia estás, y ocupa la mitad.
    lat: +mediana(p.lats).toFixed(3),
    lon: +mediana(p.lons).toFixed(3),
    estaciones: p.lats.length,
  }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

const salida = 'src/provincias.json'
writeFileSync(salida, JSON.stringify(provincias, null, 0) + '\n')

console.log(
  `${provincias.length} provincias escritas en ${salida} ` +
    `(de ${estaciones.length} estaciones, fecha del dato: ${datos.Fecha})`
)
