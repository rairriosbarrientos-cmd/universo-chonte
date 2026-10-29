// Arma demo/: la versión pública para enseñar en Facebook (otro sitio de Netlify, por arrastrar el zip).
// Igual que public/ pero sin tu número de WhatsApp, sin notificaciones (nadie se puede registrar) y sin el panel.
import fs from 'node:fs';

const raiz = new URL('../', import.meta.url), origen = new URL('public/', raiz), destino = new URL('demo/', raiz);
fs.rmSync(destino, { recursive: true, force: true });
fs.cpSync(origen, destino, { recursive: true, filter: (f) => !f.endsWith('rair.html') });
if (fs.existsSync(new URL('promo/', raiz))) fs.cpSync(new URL('promo/', raiz), new URL('promo/', destino), { recursive: true }); // fotos del post de Facebook

function parchar(archivo, cambios) {
  const ruta = new URL(archivo, destino);
  let s = fs.readFileSync(ruta, 'utf8');
  for (const [antes, despues] of cambios) {
    if (s.split(antes).length !== 2) throw new Error(`${archivo}: no encontré (o hay más de uno) → ${antes.slice(0, 60)}`);
    s = s.replace(antes, despues);
  }
  fs.writeFileSync(ruta, s);
}

parchar('index.html', [
  // sin número
  [/whatsapp: '\d+',/.exec(fs.readFileSync(new URL('index.html', destino), 'utf8'))[0], "whatsapp: '',"],
  ['<a class="chico oro" id="wa" target="_blank" rel="noopener">', '<a class="chico oro" id="wa" target="_blank" rel="noopener" hidden style="display:none">'],
  // sin notificaciones ni recordatorio
  ['<button class="chico" id="diaAviso">', '<button class="chico" id="diaAviso" hidden>'],
  ["const pushPosible = () => 'serviceWorker' in navigator", "const pushPosible = () => false && 'serviceWorker' in navigator"],
]);
parchar('_headers', [['/rair.html\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-cache\n', '']]);

const numero = /whatsapp: '(\d+)',/.exec(fs.readFileSync(new URL('index.html', origen), 'utf8'))[1];
for (const f of fs.readdirSync(destino, { recursive: true })) {
  if (/\.(html|js|json|ics|webmanifest)$/.test(f) && fs.readFileSync(new URL(f, destino), 'utf8').includes(numero.slice(2))) throw new Error(`El número sigue en demo/${f}`);
}
console.log('demo/ lista');
