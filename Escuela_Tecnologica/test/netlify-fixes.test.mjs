import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createHandlers } from '../lib/handlers.js';
import { MemoryStore } from './helpers.mjs';

test('configuration diagnosis reports missing variables without revealing credentials', async () => {
  const env={ADMIN_PASSWORD:randomBytes(20).toString('hex'),SESSION_SECRET:randomBytes(32).toString('hex')};
  const handler=createHandlers({store:new MemoryStore(),env,storageConfigured:true});
  const request=()=>new Request('https://escuela.example/api/session');
  const ready=await (await handler.session(request())).json();
  assert.equal(ready.configured,true);assert.equal(ready.release,'netlify-2026-10-31-r2');
  assert.deepEqual(ready.setup.problems,[]);
  assert.ok(!JSON.stringify(ready).includes(env.ADMIN_PASSWORD));assert.ok(!JSON.stringify(ready).includes(env.SESSION_SECRET));
  env.SESSION_SECRET='short';
  const pending=await (await handler.session(request())).json();
  assert.equal(pending.configured,false);assert.equal(pending.setup.sessionSecret,false);assert.match(pending.setup.problems.join(' '),/SESSION_SECRET/);
});
test('WhatsApp stays left on desktop and mobile; the top notice is absent',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(html,/\.whatsapp-direct\{position:fixed;left:22px;right:auto/);
  assert.match(html,/@media\(max-width:600px\)\{\.whatsapp-direct\{left:16px;right:auto/);
  assert.ok(!html.includes('<div class="demo-bar">'));
  assert.ok(!html.includes('Precios, fechas y contenidos de ejemplo sujetos a confirmación.'));
  assert.match(html,/Comprobar configuración de Netlify/);
});
test('the helper does not embed credentials or send generated values to a server',()=>{
  const helper=readFileSync(new URL('../CONFIGURAR_ACCESO.html',import.meta.url),'utf8');
  assert.match(helper,/NO cambia la contraseña del sitio/);assert.match(helper,/crypto.getRandomValues/);
  assert.ok(!helper.includes('fetch('));assert.ok(!helper.includes('localStorage'));
  assert.ok(!helper.includes('Vercel'));assert.match(helper,/type="password"/);
});
