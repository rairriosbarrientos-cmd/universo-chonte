// Lo que comparten las funciones: qué día va Chonte, qué mensaje le toca y cómo se le manda la notificación.
import { createHash, timingSafeEqual } from 'node:crypto';
import webpush from 'web-push';
import MENSAJES from './mensajes.mjs';

// Llave pública de las notificaciones (la privada vive solo en Netlify: VAPID_PRIVATE_KEY).
// La misma va en public/index.html y public/sw.js.
export const VAPID_PUBLICA = 'BF13L4v2YdyUd7SI3JFzsM4VBRwfPx48WWVuPVcFW7nu3gfMAv2VJSUrU85US-3KHTB1hXkvHb2xMHUORBsqZL8';
// Zacatecas: UTC-6 todo el año (México quitó el horario de verano en 2022).
export const ZONA = 'America/Mexico_City';
// Su cumpleaños 'MM-DD'. Igual que CONFIG.cumple en public/index.html.
export const CUMPLE = '';
const MAX_DISPOSITIVOS = 10;
const MS_DIA = 86400000;

export const json = (datos, status = 200) => new Response(JSON.stringify(datos), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export const esFecha = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const hoyEnZacatecas = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const utc = (f) => { const [y, m, d] = f.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const diasEntre = (a, b) => Math.round((utc(b) - utc(a)) / MS_DIA);

// Mismas fechas especiales que la página (public/index.html → ESPECIALES): ese día sale este mensaje en lugar del normal.
const ESPECIALES = {
  '11-15': (y) => { const a = y - 2024; return a >= 1 ? `Hoy se cumple${a > 1 ? 'n' : ''} ${a === 1 ? 'un año' : `${a} años`} desde que te conocí. Y sigo pensando que fue de lo mejor que me ha pasado ✦` : 'Hoy es 15 de noviembre: el día que te conocí ✦'; },
  '12-24': () => 'Feliz Nochebuena, Chonte 🎄 Que te sobren abrazos, tamales y risas.',
  '12-25': () => 'Feliz Navidad, Ferchi 🎁 El mejor regalo de este año fue conocerte mejor.',
  '12-31': () => 'Último día del año: gracias por hacerlo más bonito. Que el que viene te trate como mereces ✨',
  '01-01': () => 'Feliz año nuevo, Chonte 🥂 Este año te toca todo lo bueno. Yo me encargo de los mensajes.',
  '02-14': () => 'Feliz 14 de febrero 💘 No digo más porque ya sabes lo que pienso de ti 😏',
  '03-08': () => 'Feliz Día de la Mujer, Chonte. Fuerte, chingona y bien bonita. Que nunca se te olvide 💜',
  '09-16': () => '¡Viva México y viva Chonte! 🇲🇽 La zacatecana más bonita del país.',
  '11-02': () => 'Hoy es Día de Muertos 🌼 pero tú andas más viva y más bonita que nunca.',
};
if (CUMPLE) ESPECIALES[CUMPLE] = () => '¡Feliz cumpleaños, Chonte! 🎂 Hoy el universo entero celebra que existes. Pide un deseo… y luego me lo cuentas 😏';

// El día 1 es el primer día que ella abrió su universo. Después del día 365 solo le llegan las fechas especiales.
export function mensajeDelDia(inicio, hoy = hoyEnZacatecas()) {
  const n = Math.max(1, diasEntre(inicio, hoy) + 1), esp = ESPECIALES[hoy.slice(5)];
  if (n > 365 && !esp) return null;
  const dia = Math.min(n, 365);
  return {
    dia,
    titulo: n > 365 ? 'Chonte ✦' : `Chonte ✦ Día ${dia} de 365`,
    texto: esp ? esp(Number(hoy.slice(0, 4))) : (MENSAJES[dia - 1] || 'Tu mensaje de hoy ya está en la Vía Láctea 😏'),
  };
}

// ---------- Dispositivos de ella (Netlify Blobs) ----------
export const leerDispositivos = async (store) => (await store.get('suscripciones', { type: 'json' })) || [];

const b64url = (s, min, max) => typeof s === 'string' && s.length >= min && s.length <= max && /^[A-Za-z0-9_-]+=*$/.test(s);
function validarSub(sub) {
  let url;
  try { url = new URL(sub?.endpoint); } catch { throw new Error('Suscripción inválida'); }
  if (url.protocol !== 'https:' || sub.endpoint.length > 1000) throw new Error('Suscripción inválida');
  if (!b64url(sub.keys?.p256dh, 80, 100) || !b64url(sub.keys?.auth, 16, 30)) throw new Error('Suscripción inválida');
  return { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } };
}

export async function guardarDispositivo(store, { sub, inicio, viejo } = {}, ua = '') {
  const limpia = validarSub(sub);
  const lista = await leerDispositivos(store);
  const antes = lista.find((d) => d.sub.endpoint === limpia.endpoint);
  const resto = lista.filter((d) => d.sub.endpoint !== limpia.endpoint && d.sub.endpoint !== viejo);
  const ini = esFecha(inicio) ? inicio : (antes?.inicio || resto.map((d) => d.inicio).sort()[0] || hoyEnZacatecas());
  const item = { sub: limpia, inicio: ini, alta: antes?.alta || new Date().toISOString(), visto: new Date().toISOString(), ua: String(ua || antes?.ua || '').slice(0, 200) };
  const nueva = [...resto, item].slice(-MAX_DISPOSITIVOS);
  await store.setJSON('suscripciones', nueva);
  return { nueva: !antes, item };
}

// ---------- Mandar ----------
function prepararVapid() {
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!privada) throw new Error('Falta VAPID_PRIVATE_KEY en las variables de entorno de Netlify');
  webpush.setVapidDetails(process.env.URL || 'https://app.netlify.com', process.env.VAPID_PUBLIC_KEY || VAPID_PUBLICA, privada);
}

// aviso: { title, body, tag, url } o una función (dispositivo) => aviso | null, para que cada uno lleve su día.
export async function mandar(store, aviso, { a } = {}) {
  prepararVapid();
  const destinos = a || await leerDispositivos(store);
  const muertos = new Set(), errores = [];
  let enviados = 0;
  await Promise.all(destinos.map(async (d) => {
    const datos = typeof aviso === 'function' ? aviso(d) : aviso;
    if (!datos) return;
    try {
      await webpush.sendNotification(d.sub, JSON.stringify(datos), { TTL: 12 * 3600, urgency: 'normal' });
      enviados++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) muertos.add(d.sub.endpoint); // ya no existe (desinstaló o quitó el permiso)
      else errores.push(String(e.statusCode || e.message).slice(0, 120));
    }
  }));
  if (muertos.size) await store.setJSON('suscripciones', (await leerDispositivos(store)).filter((d) => !muertos.has(d.sub.endpoint)));
  return { enviados, borrados: muertos.size, errores, total: destinos.length };
}

// El de las 9 am. Si ya salió hoy no se repite (a menos que Rair lo fuerce desde su panel).
export async function mandarElDeHoy(store, { forzar = false } = {}) {
  const hoy = hoyEnZacatecas();
  const ultimo = await store.get('ultimo', { type: 'json' });
  if (!forzar && ultimo?.fecha === hoy) return { yaSalio: true, ...ultimo };
  const r = await mandar(store, (d) => {
    const m = mensajeDelDia(d.inicio, hoy);
    return m && { title: m.titulo, body: m.texto, tag: 'mensaje-diario', url: './', dia: m.dia };
  });
  const registro = { fecha: hoy, hora: new Date().toISOString(), ...r };
  await store.setJSON('ultimo', registro);
  return registro;
}

// ---------- Panel de Rair ----------
export function claveValida(dada) {
  const real = process.env.CLAVE_RAIR;
  if (!real || typeof dada !== 'string' || !dada) return false;
  const h = (s) => createHash('sha256').update(s).digest();
  return timingSafeEqual(h(dada), h(real));
}

export function equipoDe(ua = '') {
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/ipad/i.test(ua)) return 'iPad';
  if (/android/i.test(ua)) return 'Android';
  if (/macintosh/i.test(ua)) return 'Mac';
  if (/windows/i.test(ua)) return 'Windows';
  return 'Otro';
}
