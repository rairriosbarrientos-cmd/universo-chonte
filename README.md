# Universo de Chonte ✦

La estrella Ferisol, la historia en 3D, su canción, el telescopio y la Vía Láctea con 365 mensajes, uno por día.
Cada mañana a las **9:00 am (hora de Zacatecas)** le llega su mensaje del día como notificación.

## Qué hay aquí

| Carpeta / archivo | Qué es |
|---|---|
| `public/` | La página tal cual (index.html, canción, texturas, service worker, ícono, etc.) |
| `public/rair.html` | Tu panel privado: ver si tiene los avisos activos y mandarle un mensaje cuando quieras |
| `netlify/functions/suscribir.mjs` | Guarda su teléfono cuando toca 🔔 (`/api/suscribir`) |
| `netlify/functions/diario.mjs` | Le manda el mensaje del día a las 9:00 am de Zacatecas (15:00 UTC) |
| `netlify/functions/rair.mjs` | Lo que usa tu panel (`/api/rair`, pide tu clave) |
| `netlify/lib/chonte.mjs` | Qué día va, qué mensaje le toca y fechas especiales |

## Ponerlo en Netlify (una sola vez)

1. **Variables**: en tu sitio de Netlify → *Site configuration* → *Environment variables* → *Add a variable*, agrega:
   - `VAPID_PRIVATE_KEY` → la llave privada que te pasé (no va en el código)
   - `CLAVE_RAIR` → la clave de tu panel
2. **Conectar el repo**: *Site configuration* → *Build & deploy* → *Continuous deployment* → **Link repository** → GitHub → `universo-chonte` → rama `main`.
   Netlify lee `netlify.toml` solo (publica `public/` y arma las funciones). El link del sitio no cambia.
3. Espera a que el deploy salga en verde (*Deploys*). Desde ahí, cada cambio que se suba a GitHub se publica solo. Ya no hace falta arrastrar el zip.

## Cómo le llegan las notificaciones

- **Android (Chrome)**: toca 🔔 en su mensaje del día → *Permitir*. Le llega una de bienvenida al momento.
- **iPhone**: primero instalar la app: en Safari *Compartir* ⬆️ → *Agregar a inicio*, abrirla desde ese ícono y tocar 🔔 → *Permitir*. (Apple solo deja notificaciones a apps instaladas, iOS 16.4 o más nuevo.)
- Si no se puede (permiso bloqueado, iPhone viejo), le queda el recordatorio en su calendario como antes.

## Cambios comunes

- **Su cumpleaños**: pon `'MM-DD'` en `CUMPLE` (`netlify/lib/chonte.mjs`) y en `CONFIG.cumple` (`public/index.html`).
- **Mensajes**: edita `public/mensajes.json` (son 365). Las funciones los toman solas en cada deploy (`npm run build`).
- Si cambias archivos de `public/`, sube el número de `VERSION` en `public/sw.js` para que su teléfono baje lo nuevo.

## Pruebas

```bash
npm install
npm test   # funciones completas: Blobs local + push cifrado descifrado en un servidor falso
```
