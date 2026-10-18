// Prueba las funciones de Netlify de punta a punta sin internet:
// Blobs con el servidor local de @netlify/blobs y un "servicio de push" HTTPS falso que descifra lo que le llega.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { BlobsServer } from '@netlify/blobs/server';
import ece from 'http_ece';
import webpush from 'web-push';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chonte-'));
const recibidos = [];
let blobs, push, puertoPush;

// Un teléfono de mentira: sus llaves para descifrar lo que le manda el servidor.
function telefono(ruta) {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return { ecdh, auth, sub: { endpoint: `https://localhost:${puertoPush}${ruta}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } };
}
const descifrar = (tel, cuerpo) => JSON.parse(ece.decrypt(cuerpo, { version: 'aes128gcm', privateKey: tel.ecdh, authSecret: tel.auth.toString('base64url') }).toString());
const llegadas = (tel) => recibidos.filter((r) => r.url === new URL(tel.sub.endpoint).pathname).map((r) => descifrar(tel, r.cuerpo));
const pedir = (fn, url, { metodo = 'GET', cuerpo, headers = {} } = {}) =>
  fn(new Request(`http://local${url}`, { method: metodo, headers: { 'Content-Type': 'application/json', ...headers }, body: cuerpo ? JSON.stringify(cuerpo) : undefined }));

let suscribir, diario, rair, lib, tel;

before(async () => {
  // Blobs local
  blobs = new BlobsServer({ directory: path.join(dir, 'blobs'), token: 'prueba' });
  const { port } = await blobs.start();
  const base = `http://localhost:${port}`;
  process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ edgeURL: base, uncachedEdgeURL: base, siteID: 'sitio-prueba', token: 'prueba' })).toString('base64');
  // Servicio de push falso (HTTPS con certificado propio)
  execFileSync('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem'), '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  push = https.createServer({ key: fs.readFileSync(path.join(dir, 'k.pem')), cert: fs.readFileSync(path.join(dir, 'c.pem')) }, (req, res) => {
    const partes = [];
    req.on('data', (c) => partes.push(c)).on('end', () => {
      if (req.url.startsWith('/muerto')) { res.writeHead(410); return res.end(); }
      recibidos.push({ url: req.url, cuerpo: Buffer.concat(partes), headers: req.headers });
      res.writeHead(201); res.end();
    });
  });
  await new Promise((ok) => push.listen(0, ok));
  puertoPush = push.address().port;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // solo en la prueba: el servicio falso usa certificado propio
  const llaves = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = llaves.publicKey;
  process.env.VAPID_PRIVATE_KEY = llaves.privateKey;
  process.env.CLAVE_RAIR = 'clave-de-prueba';
  suscribir = (await import('../netlify/functions/suscribir.mjs')).default;
  diario = (await import('../netlify/functions/diario.mjs')).default;
  rair = (await import('../netlify/functions/rair.mjs')).default;
  lib = await import('../netlify/lib/chonte.mjs');
});
after(async () => { await blobs.stop(); push.close(); fs.rmSync(dir, { recursive: true, force: true }); });

const haceDias = (n) => { const d = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

test('qué mensaje le toca cada día', async () => {
  const MENSAJES = (await import('../netlify/lib/mensajes.mjs')).default;
  assert.equal(MENSAJES.length, 365);
  assert.deepEqual(MENSAJES, JSON.parse(fs.readFileSync(new URL('../public/mensajes.json', import.meta.url), 'utf8')));
  assert.deepEqual(lib.mensajeDelDia('2026-10-18', '2026-10-18'), { dia: 1, titulo: 'Chonte ✦ Día 1 de 365', texto: MENSAJES[0] });
  assert.equal(lib.mensajeDelDia('2026-10-18', '2026-11-26').dia, 40);
  assert.equal(lib.mensajeDelDia('2026-10-18', '2026-11-26').texto, MENSAJES[39]);
  assert.match(lib.mensajeDelDia('2026-10-18', '2026-11-15').texto, /Hoy se cumplen 2 años desde que te conocí/); // fecha especial
  assert.match(lib.mensajeDelDia('2026-10-18', '2026-12-25').texto, /Feliz Navidad/);
  assert.equal(lib.mensajeDelDia('2026-10-18', '2026-12-25').titulo, 'Chonte ✦ Día 69 de 365');
  assert.equal(lib.mensajeDelDia('2026-10-18', '2027-10-20'), null); // ya pasó su año y no es fecha especial
  assert.equal(lib.mensajeDelDia('2026-10-18', '2027-12-24').titulo, 'Chonte ✦');
  assert.equal(lib.mensajeDelDia('2026-10-19', '2026-10-18').dia, 1); // su cel adelantado un día: no truena
});

test('el botón 🔔 la da de alta y le llega la bienvenida', async () => {
  tel = telefono('/cel-1');
  const r = await pedir(suscribir, '/api/suscribir', { metodo: 'POST', cuerpo: { sub: tel.sub, inicio: haceDias(39) }, headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' } });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, nueva: true, inicio: haceDias(39) });
  const [bienvenida] = llegadas(tel);
  assert.equal(bienvenida.tag, 'bienvenida');
  assert.match(bienvenida.body, /Cada mañana a las 9/);
  assert.match(recibidos.at(-1).headers.authorization, /^vapid t=.+, k=/);
  // Otra vez el mismo teléfono: no se duplica ni le llega otra bienvenida
  const r2 = await pedir(suscribir, '/api/suscribir', { metodo: 'POST', cuerpo: { sub: tel.sub, inicio: haceDias(39) } });
  assert.equal((await r2.json()).nueva, false);
  assert.equal(llegadas(tel).length, 1);
});

test('rechaza basura', async () => {
  assert.equal((await pedir(suscribir, '/api/suscribir')).status, 405);
  assert.equal((await pedir(suscribir, '/api/suscribir', { metodo: 'POST', cuerpo: { sub: { endpoint: 'http://inseguro', keys: {} } } })).status, 400);
  assert.equal((await pedir(suscribir, '/api/suscribir', { metodo: 'POST', cuerpo: { sub: { endpoint: 'https://x.com/a', keys: { p256dh: 'corta', auth: 'x' } } } })).status, 400);
});

test('a las 9 le llega el mensaje de su día, una sola vez', async () => {
  const MENSAJES = (await import('../netlify/lib/mensajes.mjs')).default;
  await diario(new Request('http://local/', { method: 'POST', body: '{}' }));
  const hoy = llegadas(tel).find((m) => m.tag === 'mensaje-diario');
  const esperado = lib.mensajeDelDia(haceDias(39));
  assert.equal(hoy.title, 'Chonte ✦ Día 40 de 365');
  assert.equal(hoy.body, esperado.texto);
  if (!/^(11-15|12-24|12-25|12-31|01-01|02-14|03-08|09-16|11-02)$/.test(lib.hoyEnZacatecas().slice(5))) assert.equal(hoy.body, MENSAJES[39]);
  await diario(new Request('http://local/', { method: 'POST', body: '{}' })); // si Netlify lo corre dos veces, no se repite
  assert.equal(llegadas(tel).filter((m) => m.tag === 'mensaje-diario').length, 1);
});

test('panel de Rair: clave, estado y mensaje libre', async () => {
  assert.equal((await pedir(rair, '/api/rair')).status, 401);
  assert.equal((await pedir(rair, '/api/rair', { headers: { 'x-clave': 'otra' } })).status, 401);
  const k = { 'x-clave': 'clave-de-prueba' };
  const est = await (await pedir(rair, '/api/rair', { headers: k })).json();
  assert.equal(est.dispositivos.length, 1);
  assert.equal(est.dispositivos[0].equipo, 'iPhone');
  assert.equal(est.deHoy.dia, 40);
  assert.equal(est.ultimo.enviados, 1);
  const r = await (await pedir(rair, '/api/rair', { metodo: 'POST', headers: k, cuerpo: { texto: '¿Cómo estás tan curiosa? 😏', titulo: '' } })).json();
  assert.equal(r.enviados, 1);
  const libre = llegadas(tel).at(-1);
  assert.deepEqual([libre.title, libre.body], ['Rair ✦', '¿Cómo estás tan curiosa? 😏']);
  assert.equal((await pedir(rair, '/api/rair', { metodo: 'POST', headers: k, cuerpo: { texto: '   ' } })).status, 400);
  const hist = (await (await pedir(rair, '/api/rair', { headers: k })).json()).historial;
  assert.equal(hist[0].texto, '¿Cómo estás tan curiosa? 😏');
  // Reenviar el de hoy (forzado) sí sale aunque ya haya salido
  const re = await (await pedir(rair, '/api/rair', { metodo: 'POST', headers: k, cuerpo: { accion: 'hoy' } })).json();
  assert.equal(re.enviados, 1);
});

test('si ella quita el permiso, se borra ese teléfono', async () => {
  const muerto = telefono('/muerto-1');
  await pedir(suscribir, '/api/suscribir', { metodo: 'POST', cuerpo: { sub: muerto.sub, inicio: haceDias(39) } });
  const k = { 'x-clave': 'clave-de-prueba' };
  assert.equal((await (await pedir(rair, '/api/rair', { headers: k })).json()).dispositivos.length, 1); // la bienvenida ya lo detectó muerto
  const r = await (await pedir(rair, '/api/rair', { metodo: 'POST', headers: k, cuerpo: { texto: 'hola' } })).json();
  assert.deepEqual([r.enviados, r.borrados, r.total], [1, 0, 1]);
});

test('sin llave privada en Netlify avisa claro', async () => {
  const antes = process.env.VAPID_PRIVATE_KEY; delete process.env.VAPID_PRIVATE_KEY;
  const r = await pedir(rair, '/api/rair', { metodo: 'POST', headers: { 'x-clave': 'clave-de-prueba' }, cuerpo: { texto: 'hola' } });
  assert.equal(r.status, 500);
  assert.match((await r.json()).error, /VAPID_PRIVATE_KEY/);
  process.env.VAPID_PRIVATE_KEY = antes;
});
