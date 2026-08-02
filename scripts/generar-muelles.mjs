// Convierte los parametros de muelle de Apple (damping / response) en curvas
// linear() de CSS, muestreando la respuesta al escalon del sistema.
//
//   x(t) critico  (z=1):  1 - e^(-wt)(1 + wt)
//   x(t) subamort (z<1):  1 - e^(-zwt)[cos(wd t) + (zw/wd) sin(wd t)]
//   con w = 2*pi/response,  wd = w*sqrt(1-z^2)

function respuesta(z, response) {
  const w = (2 * Math.PI) / response
  if (z >= 1) {
    return (t) => 1 - Math.exp(-w * t) * (1 + w * t)
  }
  const wd = w * Math.sqrt(1 - z * z)
  return (t) =>
    1 -
    Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t))
}

function curva(nombre, z, response, muestras = 26) {
  const f = respuesta(z, response)

  // Tiempo de asentamiento: cuando ya no se separa mas de un 0,1 % del final.
  let fin = 0.05
  for (let t = 0.05; t < 4; t += 0.005) {
    if (Math.abs(f(t) - 1) > 0.001) fin = t
  }
  fin = Math.ceil((fin + 0.02) * 100) / 100

  const puntos = []
  for (let i = 0; i <= muestras; i++) {
    const t = (i / muestras) * fin
    const v = i === muestras ? 1 : f(t)
    const pct = Math.round((i / muestras) * 100)
    puntos.push(`${+v.toFixed(4)} ${pct}%`)
  }

  console.log(`\n/* ${nombre} — damping ${z}, response ${response}s */`)
  console.log(`duracion: ${fin}s`)
  console.log(`linear(${puntos.join(', ')})`)
}

// Tabla de valores de Apple recogida en la guia
curva('Mover / recolocar', 1.0, 0.4)
curva('Panel / hoja', 0.8, 0.3)
