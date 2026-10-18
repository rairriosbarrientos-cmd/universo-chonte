// Panel de Rair (public/rair.html): ver si ella tiene los avisos activos y mandarle un mensaje cuando quiera.
import { getStore } from '@netlify/blobs';
import { claveValida, equipoDe, hoyEnZacatecas, json, leerDispositivos, mandar, mandarElDeHoy, mensajeDelDia } from '../lib/chonte.mjs';

export default async (req) => {
  if (!process.env.CLAVE_RAIR) return json({ error: 'Falta CLAVE_RAIR en las variables de entorno de Netlify' }, 500);
  if (!claveValida(req.headers.get('x-clave'))) return json({ error: 'Clave incorrecta' }, 401);
  const store = getStore({ name: 'chonte', consistency: 'strong' });

  if (req.method === 'GET') {
    const lista = await leerDispositivos(store), hoy = hoyEnZacatecas();
    return json({
      hoy,
      dispositivos: lista.map((d) => ({ equipo: equipoDe(d.ua), alta: d.alta, visto: d.visto, inicio: d.inicio })),
      deHoy: lista.length ? mensajeDelDia(lista[0].inicio, hoy) : null,
      ultimo: await store.get('ultimo', { type: 'json' }),
      historial: (await store.get('historial', { type: 'json' })) || [],
    });
  }

  if (req.method === 'POST') {
    let d;
    try { d = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
    try {
      if (d.accion === 'hoy') return json(await mandarElDeHoy(store, { forzar: true }));
      const texto = String(d.texto || '').trim().slice(0, 300);
      if (!texto) return json({ error: 'Escribe el mensaje' }, 400);
      const titulo = String(d.titulo || '').trim().slice(0, 60) || 'Rair ✦';
      const r = await mandar(store, { title: titulo, body: texto, tag: `rair-${Date.now()}`, url: './' });
      const historial = (await store.get('historial', { type: 'json' })) || [];
      await store.setJSON('historial', [{ fecha: new Date().toISOString(), titulo, texto, enviados: r.enviados }, ...historial].slice(0, 30));
      return json(r);
    } catch (e) { return json({ error: e.message }, 500); }
  }

  return json({ error: 'Método no permitido' }, 405);
};

export const config = { path: '/api/rair' };
