// Todos los días a las 9:00 am de Zacatecas (15:00 UTC) le manda a Chonte el mensaje que le toca.
import { getStore } from '@netlify/blobs';
import { mandarElDeHoy } from '../lib/chonte.mjs';

export default async () => {
  const r = await mandarElDeHoy(getStore({ name: 'chonte', consistency: 'strong' }));
  console.log('mensaje del día:', JSON.stringify(r));
};

export const config = { schedule: '0 15 * * *' };
