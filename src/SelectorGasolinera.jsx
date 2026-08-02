import { useEffect, useRef, useState } from 'react'
import { formatearNumero } from './calculo.js'
import {
  COMBUSTIBLES,
  PROVINCIAS,
  cargarEstaciones,
  ordenar,
  provinciaMasCercana,
  ubicacionActual,
} from './gasolineras.js'

const CLAVE = 'fuelmates/gasolineras'
const CUANTAS_MOSTRAR = 8

function leerPreferencias() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) ?? {}
  } catch {
    return {}
  }
}

export default function SelectorGasolinera({ onElegir }) {
  const preferencias = useRef(leerPreferencias()).current

  const [abierto, setAbierto] = useState(false)
  const [combustible, setCombustible] = useState(
    preferencias.combustible ?? COMBUSTIBLES[0].campo
  )
  const [idProvincia, setIdProvincia] = useState(preferencias.idProvincia ?? '')
  const [posicion, setPosicion] = useState(null)
  const [estaciones, setEstaciones] = useState([])
  const [fecha, setFecha] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [ubicando, setUbicando] = useState(false)

  useEffect(() => {
    localStorage.setItem(CLAVE, JSON.stringify({ combustible, idProvincia }))
  }, [combustible, idProvincia])

  async function traer(id) {
    if (!id) return
    setCargando(true)
    setError('')
    try {
      const datos = await cargarEstaciones(id)
      setEstaciones(datos.estaciones)
      setFecha(datos.fecha)
    } catch (e) {
      setError(e.message)
      setEstaciones([])
    } finally {
      setCargando(false)
    }
  }

  async function localizar() {
    setUbicando(true)
    setError('')
    try {
      const pos = await ubicacionActual()
      setPosicion(pos)
      const provincia = provinciaMasCercana(pos.lat, pos.lon)
      setIdProvincia(provincia.id)
      await traer(provincia.id)
    } catch (e) {
      setError(e.message)
      // Sin ubicación aún se puede elegir provincia a mano.
      if (idProvincia) traer(idProvincia)
    } finally {
      setUbicando(false)
    }
  }

  function abrir() {
    setAbierto(true)
    if (estaciones.length > 0) return
    if (idProvincia) traer(idProvincia)
    else localizar()
  }

  function elegir(estacion) {
    const precio = estacion.precios[combustible]
    // Con coma decimal, que es como se escribe en el campo.
    onElegir(precio.toFixed(3).replace('.', ','))
    setAbierto(false)
  }

  const visibles = ordenar(estaciones, posicion, combustible).slice(
    0,
    CUANTAS_MOSTRAR
  )

  if (!abierto) {
    return (
      <button className="boton-secundario boton-buscar" onClick={abrir}>
        Buscar el precio en una gasolinera
      </button>
    )
  }

  return (
    <div className="selector-gasolinera">
      <div className="cabecera-panel">
        <strong>Elige la gasolinera</strong>
        <button
          className="boton-icono"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>

      <div className="fichas" role="group" aria-label="Carburante">
        {COMBUSTIBLES.map((c) => (
          <button
            key={c.campo}
            className={`ficha${combustible === c.campo ? ' activa' : ''}`}
            onClick={() => setCombustible(c.campo)}
            aria-pressed={combustible === c.campo}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      <div className="fila-provincia">
        <select
          className="entrada select"
          value={idProvincia}
          onChange={(e) => {
            setIdProvincia(e.target.value)
            traer(e.target.value)
          }}
          aria-label="Provincia"
        >
          <option value="">Elige provincia…</option>
          {PROVINCIAS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <button
          className="boton-secundario"
          onClick={localizar}
          disabled={ubicando}
        >
          {ubicando ? 'Ubicando…' : '📍 Cerca de mí'}
        </button>
      </div>

      {error && <p className="aviso">{error}</p>}

      {cargando ? (
        <p className="nota">Cargando gasolineras…</p>
      ) : visibles.length > 0 ? (
        <>
          <ul className="estaciones">
            {visibles.map((e) => (
              <li key={e.id}>
                <button className="estacion" onClick={() => elegir(e)}>
                  <span className="estacion-datos">
                    <strong>{e.rotulo}</strong>
                    <small>
                      {e.municipio}
                      {e.distancia != null &&
                        ` · a ${formatearNumero(e.distancia, 1)} km`}
                    </small>
                  </span>
                  <span className="estacion-precio">
                    {formatearNumero(e.precios[combustible], 3)}
                    <small> €/L</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="nota">
            Precios oficiales del Ministerio
            {fecha && ` · ${fecha}`}
          </p>
        </>
      ) : (
        !error && (
          <p className="nota">
            {idProvincia
              ? 'Ninguna gasolinera de esa provincia publica ese carburante.'
              : 'Elige una provincia o usa tu ubicación.'}
          </p>
        )
      )}
    </div>
  )
}
