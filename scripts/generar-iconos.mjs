// Genera los PNG del icono de la PWA sin dependencias externas:
// codificador PNG mínimo + rasterizado por campos de distancia (SDF) con antialias.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const DESTINO = process.argv[2] ?? 'public'

/* ---------- codificador PNG ---------- */

const TABLA_CRC = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const t = Buffer.from(tipo, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, datos])))
  return Buffer.concat([largo, t, datos, crc])
}

function codificarPng(ancho, alto, rgba) {
  const firma = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(ancho, 0)
  ihdr.writeUInt32BE(alto, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  const bruto = Buffer.alloc((ancho * 4 + 1) * alto)
  for (let y = 0; y < alto; y++) {
    bruto[y * (ancho * 4 + 1)] = 0 // sin filtro
    rgba.copy(bruto, y * (ancho * 4 + 1) + 1, y * ancho * 4, (y + 1) * ancho * 4)
  }
  return Buffer.concat([
    firma,
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(bruto, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ])
}

/* ---------- geometría ---------- */

const limitar = (v, a, b) => Math.min(b, Math.max(a, v))
const mezclar = (a, b, t) => a + (b - a) * t

function sdRectRedondeado(px, py, cx, cy, mitadX, mitadY, r) {
  const qx = Math.abs(px - cx) - (mitadX - r)
  const qy = Math.abs(py - cy) - (mitadY - r)
  const dx = Math.max(qx, 0)
  const dy = Math.max(qy, 0)
  return Math.hypot(dx, dy) + Math.min(Math.max(qx, qy), 0) - r
}

function sdCirculo(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r
}

// SDF de triángulo (adaptado del clásico de Inigo Quilez).
function sdTriangulo(px, py, ax, ay, bx, by, cx, cy) {
  const e0x = bx - ax, e0y = by - ay
  const e1x = cx - bx, e1y = cy - by
  const e2x = ax - cx, e2y = ay - cy
  const v0x = px - ax, v0y = py - ay
  const v1x = px - bx, v1y = py - by
  const v2x = px - cx, v2y = py - cy

  const proy = (vx, vy, ex, ey) => {
    const t = limitar((vx * ex + vy * ey) / (ex * ex + ey * ey), 0, 1)
    return [vx - ex * t, vy - ey * t]
  }
  const [p0x, p0y] = proy(v0x, v0y, e0x, e0y)
  const [p1x, p1y] = proy(v1x, v1y, e1x, e1y)
  const [p2x, p2y] = proy(v2x, v2y, e2x, e2y)

  const s = Math.sign(e0x * e2y - e0y * e2x)
  const d = Math.min(
    p0x * p0x + p0y * p0y,
    p1x * p1x + p1y * p1y,
    p2x * p2x + p2y * p2y
  )
  const signo = Math.min(
    Math.min(s * (v0x * e0y - v0y * e0x), s * (v1x * e1y - v1y * e1x)),
    s * (v2x * e2y - v2y * e2x)
  )
  return -Math.sqrt(d) * Math.sign(signo)
}

// Unión suave: funde el círculo y el triángulo en una gota orgánica.
function unionSuave(a, b, k) {
  const h = limitar(0.5 + (0.5 * (b - a)) / k, 0, 1)
  return mezclar(b, a, h) - k * h * (1 - h)
}

/* ---------- el icono ---------- */

const TEAL_CLARO = [45, 212, 191]
const TEAL_OSCURO = [13, 118, 110]

function dibujarIcono(tam, { redondear, escalaGota }) {
  const rgba = Buffer.alloc(tam * tam * 4)
  const aa = 1.2 / tam // ancho del antialias en coordenadas 0..1

  // La gota: círculo abajo + triángulo arriba, fundidos.
  const cx = 0.5
  const cyCirculo = 0.5 + 0.08 * escalaGota
  const radio = 0.22 * escalaGota
  const apice = 0.5 - 0.32 * escalaGota

  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const px = (x + 0.5) / tam
      const py = (y + 0.5) / tam

      // Fondo: degradado en diagonal.
      const t = limitar((px * 0.45 + py * 0.75) / 1.2, 0, 1)
      let r = mezclar(TEAL_CLARO[0], TEAL_OSCURO[0], t)
      let g = mezclar(TEAL_CLARO[1], TEAL_OSCURO[1], t)
      let b = mezclar(TEAL_CLARO[2], TEAL_OSCURO[2], t)

      // Silueta del fondo (cuadrado redondeado o a sangre para maskable).
      const dFondo = redondear
        ? sdRectRedondeado(px, py, 0.5, 0.5, 0.5, 0.5, 0.22)
        : -1
      const alfaFondo = limitar(0.5 - dFondo / aa, 0, 1)

      // La gota, en blanco.
      const dGota = unionSuave(
        sdCirculo(px, py, cx, cyCirculo, radio),
        sdTriangulo(
          px, py,
          cx, apice,
          cx - radio * 0.98, cyCirculo,
          cx + radio * 0.98, cyCirculo
        ),
        0.07 * escalaGota
      )
      const alfaGota = limitar(0.5 - dGota / aa, 0, 1)

      r = mezclar(r, 255, alfaGota)
      g = mezclar(g, 255, alfaGota)
      b = mezclar(b, 255, alfaGota)

      const i = (y * tam + x) * 4
      rgba[i] = Math.round(r)
      rgba[i + 1] = Math.round(g)
      rgba[i + 2] = Math.round(b)
      rgba[i + 3] = Math.round(alfaFondo * 255)
    }
  }
  return codificarPng(tam, tam, rgba)
}

mkdirSync(DESTINO, { recursive: true })

const salidas = [
  ['icon-192.png', 192, { redondear: true, escalaGota: 1 }],
  ['icon-512.png', 512, { redondear: true, escalaGota: 1 }],
  // Maskable: a sangre y con la gota más pequeña, dentro de la zona segura.
  ['icon-maskable-512.png', 512, { redondear: false, escalaGota: 0.72 }],
  // iOS aplica su propia máscara: fondo completo, sin transparencia.
  ['apple-touch-icon.png', 180, { redondear: false, escalaGota: 0.92 }],
]

for (const [nombre, tam, opciones] of salidas) {
  writeFileSync(join(DESTINO, nombre), dibujarIcono(tam, opciones))
  console.log('generado', nombre, tam + 'px')
}
