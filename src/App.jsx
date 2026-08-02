import { useEffect, useMemo, useRef, useState } from 'react'
import {
  calcularViaje,
  formatearEuros,
  formatearNumero,
  parseNum,
} from './calculo.js'
import SelectorGasolinera from './SelectorGasolinera.jsx'

const CLAVE_GUARDADO = 'calculadora-gasolina/v1'

// Sin contar al conductor. Ningún turismo lleva más.
const MAX_PASAJEROS = 7

const ESTADO_INICIAL = {
  modo: 'distancia', // 'distancia' | 'total'
  consumo: '6,5',
  precio: '1,55',
  km: '',
  idaYVuelta: false,
  costeReposte: '',
  extras: '',
  conductorPaga: true,
  detallado: false,
  personas: [
    { id: 1, nombre: 'Yo (conductor)', esConductor: true, km: '' },
    { id: 2, nombre: 'Pasajero 1', esConductor: false, km: '' },
  ],
}

function cargarEstado() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_GUARDADO))
    if (!guardado) return ESTADO_INICIAL
    // Solo recuperamos lo que tiene sentido conservar entre viajes.
    return {
      ...ESTADO_INICIAL,
      modo: guardado.modo ?? ESTADO_INICIAL.modo,
      consumo: guardado.consumo ?? ESTADO_INICIAL.consumo,
      precio: guardado.precio ?? ESTADO_INICIAL.precio,
      conductorPaga: guardado.conductorPaga ?? ESTADO_INICIAL.conductorPaga,
    }
  } catch {
    return ESTADO_INICIAL
  }
}

export default function App() {
  const [estado, setEstado] = useState(cargarEstado)
  const [copiado, setCopiado] = useState(false)

  const {
    modo,
    consumo,
    precio,
    km,
    idaYVuelta,
    costeReposte,
    extras,
    conductorPaga,
    detallado,
    personas,
  } = estado

  const porDistancia = modo === 'distancia'

  const set = (campo) => (valor) => setEstado((e) => ({ ...e, [campo]: valor }))

  useEffect(() => {
    localStorage.setItem(
      CLAVE_GUARDADO,
      JSON.stringify({ modo, consumo, precio, conductorPaga })
    )
  }, [modo, consumo, precio, conductorPaga])

  const resultado = useMemo(
    () =>
      calcularViaje({
        modo,
        km: parseNum(km),
        idaYVuelta,
        consumo: parseNum(consumo),
        precio: parseNum(precio),
        costeReposte: parseNum(costeReposte),
        extras: parseNum(extras),
        personas,
        conductorPaga,
      }),
    [
      modo,
      km,
      idaYVuelta,
      consumo,
      precio,
      costeReposte,
      extras,
      personas,
      conductorPaga,
    ]
  )

  function añadirPasajero() {
    setEstado((e) => {
      const numero = e.personas.filter((p) => !p.esConductor).length + 1
      if (numero > MAX_PASAJEROS) return e
      const id = Math.max(0, ...e.personas.map((p) => p.id)) + 1
      return {
        ...e,
        personas: [
          ...e.personas,
          { id, nombre: `Pasajero ${numero}`, esConductor: false, km: '' },
        ],
      }
    })
  }

  function quitarPersona(id) {
    setEstado((e) => ({ ...e, personas: e.personas.filter((p) => p.id !== id) }))
  }

  function editarPersona(id, campo, valor) {
    setEstado((e) => ({
      ...e,
      personas: e.personas.map((p) =>
        p.id === id ? { ...p, [campo]: valor } : p
      ),
    }))
  }

  async function copiarResumen() {
    const lineas = [
      porDistancia
        ? `⛽ Gasolina del viaje — ${formatearNumero(resultado.distancia, 0)} km`
        : '⛽ Gasolina del viaje',
      `Total: ${formatearEuros(resultado.costeTotal)}${
        porDistancia ? ` (${formatearNumero(resultado.litros, 1)} L)` : ''
      }${resultado.costeExtras > 0 ? ' + extras' : ''}`,
      '',
      ...resultado.reparto.map(
        (p) =>
          `${p.nombre}: ${p.aporta ? formatearEuros(p.paga) : 'no paga'}`
      ),
    ]
    try {
      await navigator.clipboard.writeText(lineas.join('\n'))
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  const pasajeros = personas.filter((p) => !p.esConductor)
  const cocheLleno = pasajeros.length >= MAX_PASAJEROS
  const hayDatos = resultado.costeTotal > 0

  // La barra de resumen solo tiene sentido cuando el resultado no se ve.
  const refResultado = useRef(null)
  const [resultadoALaVista, setResultadoALaVista] = useState(true)

  useEffect(() => {
    const nodo = refResultado.current
    if (!nodo || typeof IntersectionObserver === 'undefined') return
    const observador = new IntersectionObserver(
      ([entrada]) => setResultadoALaVista(entrada.isIntersecting),
      { threshold: 0.2 }
    )
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [])

  const aportantes = resultado.reparto.filter((p) => p.aporta)
  const pagoMayor = aportantes.length ? Math.max(...aportantes.map((p) => p.paga)) : 0
  // "Todos igual" con un céntimo de margen: al repartir 27,41 € entre cuatro,
  // uno paga 6,86 y el resto 6,85, y sigue siendo un reparto a partes iguales.
  const todosPaganIgual =
    aportantes.length > 1 &&
    pagoMayor - Math.min(...aportantes.map((p) => p.paga)) <= 0.011

  return (
    <div className="app">
      <header className="cabecera">
        <Gota className="logo" />
        <h1>FuelMates</h1>
        <p className="subtitulo">Cuánto pone cada uno en el viaje</p>
      </header>

      <div className="selector-modo" role="tablist" aria-label="Cómo calcular">
        <span
          className="indicador"
          aria-hidden="true"
          style={{ transform: `translateX(${porDistancia ? '0%' : '100%'})` }}
        />
        <button
          role="tab"
          aria-selected={porDistancia}
          className={porDistancia ? 'activo' : ''}
          onClick={() => set('modo')('distancia')}
        >
          Por distancia
        </button>
        <button
          role="tab"
          aria-selected={!porDistancia}
          className={!porDistancia ? 'activo' : ''}
          onClick={() => set('modo')('total')}
        >
          Coste total
        </button>
      </div>

      {porDistancia && (
        <section className="tarjeta">
          <h2>El coche</h2>
          <div className="fila">
            <Campo
              etiqueta="Consumo"
              sufijo="L/100 km"
              valor={consumo}
              onChange={set('consumo')}
              placeholder="6,5"
            />
            <Campo
              etiqueta="Precio del litro"
              sufijo="€/L"
              valor={precio}
              onChange={set('precio')}
              placeholder="1,55"
            />
          </div>
          <SelectorGasolinera onElegir={set('precio')} />
          <p className="nota">
            Se guarda en este dispositivo para el próximo viaje.
          </p>
        </section>
      )}

      <section className="tarjeta">
        <h2>El viaje</h2>
        <div className="fila">
          {porDistancia ? (
            <Campo
              etiqueta="Distancia"
              sufijo="km"
              valor={km}
              onChange={set('km')}
              placeholder="0"
              autoFocus
            />
          ) : (
            <Campo
              etiqueta="Lo que costó repostar"
              sufijo="€"
              valor={costeReposte}
              onChange={set('costeReposte')}
              placeholder="0"
              autoFocus
            />
          )}
          <Campo
            etiqueta="Peajes, parking…"
            sufijo="€"
            valor={extras}
            onChange={set('extras')}
            placeholder="0"
          />
        </div>
        {porDistancia ? (
          <Interruptor
            activo={idaYVuelta}
            onChange={set('idaYVuelta')}
            titulo="Ida y vuelta"
            descripcion={
              idaYVuelta
                ? `Pon los km de ida: se cuentan ${formatearNumero(
                    resultado.distancia,
                    0
                  )} km en total`
                : 'Solo se cuenta el trayecto de ida'
            }
          />
        ) : detallado ? (
          <div className="fila">
            <Campo
              etiqueta="Distancia del viaje"
              sufijo="km"
              valor={km}
              onChange={set('km')}
              placeholder="0"
            />
            <p className="nota nota-campo">
              Necesaria solo para repartir entre quienes hacen trayectos
              distintos.
            </p>
          </div>
        ) : (
          <p className="nota">
            Mete el importe del surtidor y se reparte tal cual, sin cuentas de
            consumo.
          </p>
        )}
      </section>

      <section className="tarjeta">
        <div className="cabecera-tarjeta">
          <h2>Quién va</h2>
          <button
            className="boton-secundario"
            onClick={añadirPasajero}
            disabled={cocheLleno}
            title={
              cocheLleno
                ? `Máximo ${MAX_PASAJEROS} pasajeros`
                : 'Añadir un pasajero'
            }
          >
            + Pasajero
          </button>
        </div>

        <ul className="personas">
          {personas.map((p) => (
            <li key={p.id} className="persona">
              <Avatar persona={p} />
              {detallado ? (
                <input
                  className="entrada nombre"
                  value={p.nombre}
                  onChange={(ev) => editarPersona(p.id, 'nombre', ev.target.value)}
                  aria-label="Nombre"
                />
              ) : (
                <span className="nombre-fijo">{p.nombre}</span>
              )}

              {detallado && (
                <div className="km-persona">
                  <input
                    className="entrada km"
                    inputMode="decimal"
                    value={p.km}
                    placeholder={
                      porDistancia || parseNum(km) > 0
                        ? formatearNumero(resultado.trayectoCompleto, 0)
                        : 'todo'
                    }
                    onChange={(ev) => editarPersona(p.id, 'km', ev.target.value)}
                    aria-label={`Kilómetros de ${p.nombre}`}
                  />
                  <span className="sufijo">km</span>
                </div>
              )}

              {personas.length > 1 && (
                <button
                  className="boton-icono"
                  onClick={() => quitarPersona(p.id)}
                  aria-label={`Quitar a ${p.nombre}`}
                  title="Quitar"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>

        {cocheLleno && (
          <p className="nota" role="status">
            Máximo {MAX_PASAJEROS} pasajeros. Quita a alguien para añadir a otro.
          </p>
        )}

        <Interruptor
          activo={conductorPaga}
          onChange={set('conductorPaga')}
          titulo="El conductor pone su parte"
          descripcion={
            conductorPaga
              ? `Se reparte entre los ${personas.length} ocupantes`
              : `Lo cubren los ${pasajeros.length} pasajeros`
          }
        />
        <Interruptor
          activo={detallado}
          onChange={set('detallado')}
          titulo="Nombres y trayectos distintos"
          descripcion="Para quien se baja a mitad de camino"
        />
      </section>

      <section className="tarjeta resultado" ref={refResultado}>
        <h2>Resultado</h2>

        {!hayDatos ? (
          <p className="vacio">
            {porDistancia
              ? 'Introduce los kilómetros para ver el reparto.'
              : 'Introduce lo que costó el repostaje para ver el reparto.'}
          </p>
        ) : (
          <>
            <div className="total">
              <span className="total-etiqueta">Coste del viaje</span>
              <strong className="total-cifra">
                {formatearEuros(resultado.costeTotal)}
              </strong>
            </div>
            <p className="desglose">
              {porDistancia && (
                <>
                  {formatearNumero(resultado.distancia, 0)} km ·{' '}
                  {formatearNumero(resultado.litros, 1)} L ·{' '}
                </>
              )}
              {formatearEuros(resultado.costeCombustible)} de combustible
              {resultado.costeExtras > 0 &&
                ` + ${formatearEuros(resultado.costeExtras)} de extras`}
            </p>

            {resultado.nadieAporta ? (
              <p className="aviso">
                Nadie está aportando: añade pasajeros o activa que el conductor
                ponga su parte.
              </p>
            ) : (
              <ul className="reparto">
                {resultado.reparto.map((p) => (
                  <li key={p.id} className={p.aporta ? '' : 'exento'}>
                    <Avatar persona={p} />
                    <span className="reparto-nombre">{p.nombre}</span>
                    <strong>
                      {p.aporta ? formatearEuros(p.paga) : 'no paga'}
                    </strong>
                  </li>
                ))}
              </ul>
            )}

            <button className="boton" onClick={copiarResumen}>
              {copiado ? '✓ Copiado' : 'Copiar resumen'}
            </button>
          </>
        )}
      </section>

      <div
        className={`barra-resumen${
          hayDatos && !resultadoALaVista ? '' : ' oculta'
        }`}
        aria-hidden={!hayDatos || resultadoALaVista}
      >
        <div className="barra-interior">
          <span className="barra-datos">
            <small>{todosPaganIgual ? 'Cada uno pone' : 'Coste del viaje'}</small>
            <strong>
              {formatearEuros(
                todosPaganIgual ? pagoMayor : resultado.costeTotal
              )}
            </strong>
          </span>
          <button
            className="boton-secundario"
            onClick={() =>
              refResultado.current?.scrollIntoView({
                // Sin salto brusco, pero respetando a quien pide menos movimiento
                behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                  ? 'auto'
                  : 'smooth',
                block: 'center',
              })
            }
            tabIndex={hayDatos && !resultadoALaVista ? 0 : -1}
          >
            Ver reparto
          </button>
        </div>
      </div>
    </div>
  )
}

function Gota({ className }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <path
        fill="currentColor"
        d="M32 11.5s-14 16.5-14 25.5a14 14 0 0 0 28 0c0-9-14-25.5-14-25.5z"
      />
    </svg>
  )
}

// Círculo con la inicial. El conductor lleva el color de acento para
// distinguirlo de un vistazo sin necesidad de leer el nombre.
function Avatar({ persona }) {
  const inicial = persona.nombre.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      className={`avatar${persona.esConductor ? ' avatar-conductor' : ''}`}
      aria-hidden="true"
    >
      {inicial}
    </span>
  )
}

function Campo({ etiqueta, sufijo, valor, onChange, placeholder, autoFocus }) {
  return (
    <label className="campo">
      <span className="etiqueta">{etiqueta}</span>
      <div className="entrada-grupo">
        <input
          className="entrada"
          inputMode="decimal"
          value={valor}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="sufijo">{sufijo}</span>
      </div>
    </label>
  )
}

function Interruptor({ activo, onChange, titulo, descripcion }) {
  return (
    <label className="interruptor">
      <input
        type="checkbox"
        checked={activo}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="palanca" aria-hidden="true" />
      <span className="texto">
        <strong>{titulo}</strong>
        <small>{descripcion}</small>
      </span>
    </label>
  )
}
