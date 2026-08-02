// Lógica pura del reparto. Sin React, para poder probarla por separado.

/**
 * Convierte lo que escribe el usuario ("6,5", " 7.2 ", "") en un número.
 * Acepta coma como separador decimal, que es lo natural en español.
 */
export function parseNum(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0
  const limpio = String(valor ?? '').trim().replace(',', '.')
  if (limpio === '') return 0
  const n = Number(limpio)
  return Number.isFinite(n) ? n : 0
}

export function formatearEuros(n) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(n)
}

export function formatearNumero(n, decimales = 2) {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(n)
}

/**
 * Reparte una cantidad entera de céntimos según unos pesos, de forma que
 * la suma de las partes sea EXACTAMENTE el total (método del resto mayor).
 * Así nunca sobra ni falta un céntimo al sumar lo que paga cada uno.
 */
export function repartirCentimos(totalCentimos, pesos) {
  const sumaPesos = pesos.reduce((a, b) => a + b, 0)
  if (sumaPesos <= 0 || totalCentimos <= 0) return pesos.map(() => 0)

  const exactos = pesos.map((p) => (totalCentimos * p) / sumaPesos)
  const base = exactos.map(Math.floor)
  let restantes = totalCentimos - base.reduce((a, b) => a + b, 0)

  // Los céntimos sueltos van a quien tiene el resto decimal más alto.
  const orden = exactos
    .map((valor, i) => ({ i, resto: valor - Math.floor(valor) }))
    .sort((a, b) => b.resto - a.resto)

  for (let k = 0; k < orden.length && restantes > 0; k++) {
    base[orden[k].i] += 1
    restantes -= 1
  }
  return base
}

/**
 * Calcula el coste del viaje y cuánto le toca a cada ocupante.
 *
 * modo 'distancia': el coste sale de km × consumo × precio del litro.
 * modo 'total':     el coste lo pone el usuario (lo que marcó el surtidor).
 *
 * personas: [{ id, nombre, esConductor, km }]  km = distancia que hace esa persona
 * conductorPaga: si false, el conductor no aporta y los pasajeros cubren el 100%
 */
export function calcularViaje({
  modo = 'distancia',
  km = 0,
  idaYVuelta = false,
  consumo = 0,
  precio = 0,
  costeReposte = 0,
  extras = 0,
  personas = [],
  conductorPaga = true,
}) {
  const porDistancia = modo === 'distancia'

  const distancia = porDistancia ? Math.max(0, km) * (idaYVuelta ? 2 : 1) : 0
  const litros = porDistancia ? (distancia / 100) * Math.max(0, consumo) : null
  const costeCombustible = porDistancia
    ? litros * Math.max(0, precio)
    : Math.max(0, costeReposte)
  const costeExtras = Math.max(0, extras)
  const costeTotal = costeCombustible + costeExtras

  // Referencia de "trayecto completo" para quien deja sus km en blanco.
  // En modo total no hay distancia calculada: se usa la que indique el usuario
  // y, si no la indica, el trayecto más largo de la lista.
  const kmEscritos = personas
    .filter((p) => p.km !== '' && p.km != null)
    .map((p) => Math.max(0, parseNum(p.km)))
  const trayectoCompleto = porDistancia
    ? distancia
    : Math.max(0, km) > 0
      ? Math.max(0, km)
      : Math.max(1, ...kmEscritos, 0)

  // Quien no aporta tiene peso 0: el conductor si está exento, o quien haga 0 km.
  // km vacío = hace el trayecto entero.
  const pesos = personas.map((p) => {
    if (p.esConductor && !conductorPaga) return 0
    const suyos = p.km === '' || p.km == null ? trayectoCompleto : parseNum(p.km)
    return Math.max(0, Math.min(suyos, trayectoCompleto))
  })

  const centimos = repartirCentimos(Math.round(costeTotal * 100), pesos)

  const reparto = personas.map((p, i) => ({
    ...p,
    kmEfectivos: pesos[i],
    paga: centimos[i] / 100,
    aporta: pesos[i] > 0,
  }))

  const sumaPesos = pesos.reduce((a, b) => a + b, 0)

  return {
    porDistancia,
    distancia,
    litros,
    trayectoCompleto,
    costeCombustible,
    costeExtras,
    costeTotal,
    costePorKm: distancia > 0 ? costeTotal / distancia : 0,
    reparto,
    // Avisos para enseñar en pantalla en lugar de dar un resultado raro en silencio.
    nadieAporta: sumaPesos === 0 && costeTotal > 0,
  }
}
