// Guarda el teléfono de Chonte para mandarle su mensaje cada mañana (lo llama el botón 🔔 de la página).
import { getStore } from '@netlify/blobs';
import { guardarDispositivo, mandar, json } from '../lib/chonte.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405);
  let datos;
  try { datos = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const store = getStore({ name: 'chonte', consistency: 'strong' });
  let r;
  try { r = await guardarDispositivo(store, datos, req.headers.get('user-agent')); } catch (e) { return json({ error: e.message }, 400); }
  if (r.nueva) { // la primera vez le llega una de bienvenida: así sabe que sí quedó
    try { await mandar(store, { title: 'Chonte ✦', body: 'Listo 😏 Cada mañana a las 9 te llega aquí tu mensaje del día.', tag: 'bienvenida', url: './' }, { a: [r.item] }); }
    catch (e) { console.error('bienvenida:', e.message); }
  }
  return json({ ok: true, nueva: r.nueva, inicio: r.item.inicio });
};

export const config = { path: '/api/suscribir' };
