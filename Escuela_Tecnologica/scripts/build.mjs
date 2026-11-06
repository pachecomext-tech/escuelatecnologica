import { readFileSync, existsSync } from 'node:fs';
import { defaultCatalog, validateCatalog } from '../lib/validation.js';
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
new Function(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
validateCatalog(defaultCatalog());
if (html.includes('EscuelaIA2026!') || html.includes('save(KEY,data)')) throw Error('Se encontró código de la demo local.');
for (const file of ['../netlify/functions/catalog.mjs', '../netlify/functions/session.mjs', '../lib/security.js', '../lib/netlify-store.js', '../lib/products-shared.js', '../public/assets/antiinsomnio.webp', '../public/assets/reconectar-parejas.webp', '../public/assets/mente-activa.webp']) if (!existsSync(new URL(file, import.meta.url))) throw Error('Falta un archivo del servidor.');
console.log('Catálogo, JavaScript y archivos de publicación verificados.');
