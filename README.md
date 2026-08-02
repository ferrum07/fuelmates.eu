# ⛽ FuelMates

Reparte el coste de combustible de un viaje entre los ocupantes del coche.

Publicada en [fuelmates.eu](https://fuelmates.eu).

## Arrancar

```bash
npm run dev
```

Se abre en http://localhost:5173.

## Publicar

```bash
npm run build
```

Genera la carpeta `docs/`, que es la web ya compilada. Se llama así porque
GitHub Pages, publicando desde una rama, solo admite la raíz del repositorio o
una carpeta llamada exactamente `docs`.

Para actualizar la web: lanzar el build y subir el contenido de `docs/` al
repositorio. En **Settings → Pages** el origen debe ser *Deploy from a branch*
→ rama `main` → carpeta `/docs`.

`docs/CNAME` lleva el dominio propio y lo genera el build desde
[public/CNAME](public/CNAME); no hay que tocarlo a mano.

## Cómo calcula

Hay dos modos, se eligen arriba del todo:

**Por distancia** — no sabes lo que costó el depósito, lo estimas:

```
distancia   = km × (2 si es ida y vuelta)
litros      = distancia / 100 × consumo
coste total = litros × precio + extras (peajes, parking)
```

**Coste total** — metes directamente lo que marcó el surtidor:

```
coste total = importe del repostaje + extras
```

El total se reparte **proporcionalmente a los kilómetros que hace cada uno**.
Si todos hacen el trayecto entero, es una división a partes iguales.

Dos ajustes cambian el reparto:

- **El conductor pone su parte**: activado, el coste se divide entre todos los
  ocupantes (lo habitual). Desactivado, los pasajeros cubren el 100 %.
- **Nombres y trayectos distintos**: permite poner nombre a cada persona e
  indicar cuántos kilómetros hace, para quien se sube o baja a mitad de camino.
  En modo *coste total* aparece además un campo con la distancia del viaje: sin
  ella no hay forma de saber qué fracción hace cada uno.

Los céntimos se reparten con el método del resto mayor, así que la suma de lo
que paga cada uno coincide **exactamente** con el total, sin descuadres de un
céntimo.

El consumo del coche y el precio del combustible se guardan en el navegador
(`localStorage`) para no reescribirlos en cada viaje.

## App instalable (PWA)

Funciona sin conexión y se puede instalar en la pantalla de inicio: en Android,
menú del navegador → *Instalar aplicación*; en iPhone, Compartir → *Añadir a
pantalla de inicio*.

- El service worker se genera solo en cada `npm run build`, con la lista real de
  archivos (llevan hash en el nombre, no se puede escribir a mano). El código
  está en [vite.config.js](vite.config.js).
- Estrategia: **red primero** al abrir la app, para recibir las
  actualizaciones; **caché primero** para JS, CSS e iconos, refrescando por
  detrás. Sin cobertura, tira de la copia guardada.
- Al publicar una versión nueva, la caché vieja se borra y la página se recarga
  sola para no quedarse a medias entre el HTML viejo y los archivos nuevos.
- En desarrollo (`npm run dev`) el service worker no se registra, que solo
  estorba.

Los iconos no son binarios traídos de ningún sitio: los dibuja
[scripts/generar-iconos.mjs](scripts/generar-iconos.mjs) con un codificador PNG
propio y campos de distancia. Para cambiar el color o la forma, se edita el
script y se relanza:

```bash
npm run iconos
```

## Estructura

- [src/calculo.js](src/calculo.js) — toda la lógica del cálculo y el reparto,
  sin React. Es donde tocar si cambian las reglas.
- [src/App.jsx](src/App.jsx) — la interfaz.
- [src/styles.css](src/styles.css) — estilos, con modo claro y oscuro.
- [scripts/generar-iconos.mjs](scripts/generar-iconos.mjs) — genera los PNG del
  icono.
- [vite.config.js](vite.config.js) — build, rutas relativas y service worker.
