// Copia los 365 mensajes de la página (public/mensajes.json) a las funciones, para que la notificación diga lo mismo.
// Corre solo en cada deploy de Netlify (npm run build).
import fs from 'node:fs';
const mensajes = JSON.parse(fs.readFileSync(new URL('../public/mensajes.json', import.meta.url), 'utf8'));
if (!Array.isArray(mensajes) || mensajes.length !== 365) throw new Error(`public/mensajes.json debe tener 365 mensajes (tiene ${mensajes.length})`);
fs.writeFileSync(new URL('../netlify/lib/mensajes.mjs', import.meta.url),
  `// Generado por scripts/mensajes.mjs desde public/mensajes.json. No editar a mano.\nexport default ${JSON.stringify(mensajes, null, 1)};\n`);
console.log('mensajes listos:', mensajes.length);
