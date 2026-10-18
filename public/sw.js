// Universo de Chonte: funciona sin internet y le llega su mensaje del día como notificación.
const VERSION = 'chonte-v3';
const VAPID_PUBLICA = 'BF13L4v2YdyUd7SI3JFzsM4VBRwfPx48WWVuPVcFW7nu3gfMAv2VJSUrU85US-3KHTB1hXkvHb2xMHUORBsqZL8';
const ARCHIVOS = [
  './',
  'index.html',
  'mensajes.json',
  'cancion.mp3',
  'manifest.webmanifest',
  'chonte.ics',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
  'lib/jsm/postprocessing/EffectComposer.js',
  'lib/jsm/postprocessing/MaskPass.js',
  'lib/jsm/postprocessing/OutputPass.js',
  'lib/jsm/postprocessing/Pass.js',
  'lib/jsm/postprocessing/RenderPass.js',
  'lib/jsm/postprocessing/ShaderPass.js',
  'lib/jsm/postprocessing/UnrealBloomPass.js',
  'lib/jsm/shaders/CopyShader.js',
  'lib/jsm/shaders/LuminosityHighPassShader.js',
  'lib/jsm/shaders/OutputShader.js',
  'lib/jsm/utils/BufferGeometryUtils.js',
  'lib/jspdf.umd.min.js',
  'lib/three.module.min.js',
  'tex/earth_day.jpg',
  'tex/earth_extra.jpg',
  'tex/earth_night.jpg',
  'tex/moon.jpg',
  'tex/mw_nx.jpg',
  'tex/mw_ny.jpg',
  'tex/mw_nz.jpg',
  'tex/mw_px.jpg',
  'tex/mw_py.jpg',
  'tex/mw_pz.jpg',
];
self.addEventListener('install', (e) => e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('chonte-v') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/') || url.pathname.endsWith('/rair.html')) return; // lo del servidor y el panel de Rair, siempre de internet
  if (url.origin === location.origin) { // lo de la app: primero lo guardado, si no hay, de internet
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => (r ? conRango(req, r) : fetch(req).then((res) => {
      if (res.status === 200) { const copia = res.clone(); caches.open(VERSION).then((c) => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match('index.html')))));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) { // letras: se guardan la primera vez
    e.respondWith(caches.open('chonte-fuentes').then(async (c) => {
      const r = await c.match(req);
      const red = fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => r);
      return r || red;
    }));
  }
});
// La canción: Safari pide el audio por pedazos (Range) y sin red hay que darle el pedazo exacto desde lo guardado.
async function conRango(req, res) {
  const rango = req.headers.get('range');
  const m = rango && /^bytes=(\d*)-(\d*)$/.exec(rango.trim());
  if (!m || res.status !== 200) return res;
  const buf = await res.arrayBuffer(), total = buf.byteLength;
  let ini, fin;
  if (m[1] === '') { ini = Math.max(0, total - Number(m[2] || 0)); fin = total - 1; } // bytes=-N (los últimos N)
  else { ini = Number(m[1]); fin = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1); }
  if (ini >= total || ini > fin) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  return new Response(buf.slice(ini, fin + 1), { status: 206, statusText: 'Partial Content', headers: {
    'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
    'Content-Range': `bytes ${ini}-${fin}/${total}`,
    'Content-Length': String(fin - ini + 1),
    'Accept-Ranges': 'bytes',
  } });
}
// Su mensaje del día (lo manda Netlify a las 9 am) y los que le mande Rair.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || 'Chonte ✦', {
      body: d.body || 'Tu mensaje de hoy ya está en la Vía Láctea 😏', icon: 'icon-192.png', badge: 'icon-192.png',
      tag: d.tag || 'mensaje-diario', data: { url: d.url || './' },
    });
    if (d.tag === 'mensaje-diario') await (await caches.open('chonte-datos')).put('avisado', new Response(new Date().toDateString())); // pa' que no se repita con el aviso de respaldo
  })());
});
// Si el teléfono renueva la suscripción, se vuelve a dar de alta sola.
self.addEventListener('pushsubscriptionchange', (e) => e.waitUntil((async () => {
  const b = atob((VAPID_PUBLICA + '='.repeat((4 - VAPID_PUBLICA.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(b, (c) => c.charCodeAt(0)) });
  const ini = await (await caches.open('chonte-datos')).match('inicio');
  await fetch('/api/suscribir', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sub: sub.toJSON(), inicio: ini ? await ini.text() : null, viejo: e.oldSubscription ? e.oldSubscription.endpoint : null }) });
})().catch(() => {})));
// Respaldo sin servidor (Chrome en Android, con la app instalada).
self.addEventListener('periodicsync', (e) => { if (e.tag === 'mensaje-diario') e.waitUntil(avisarHoy()); });
async function avisarHoy() {
  const datos = await caches.open('chonte-datos');
  const hoyTxt = new Date().toDateString();
  const ya = await datos.match('avisado');
  if (ya && (await ya.text()) === hoyTxt) return;
  const ini = await datos.match('inicio');
  let n = 1;
  if (ini) {
    const [y, m, d] = (await ini.text()).split('-').map(Number), hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    n = Math.min(365, Math.max(1, Math.round((hoy - new Date(y, m - 1, d)) / 86400000) + 1));
  }
  await self.registration.showNotification(`Chonte ✦ Día ${n} de 365`, { body: 'Tu mensaje de hoy ya está en la Vía Láctea. Ve a leerlo 😏', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'mensaje-diario' });
  await datos.put('avisado', new Response(hoyTxt));
}
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => (ws[0] ? ws[0].focus() : self.clients.openWindow(url))));
});
