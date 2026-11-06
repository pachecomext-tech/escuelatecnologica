import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createHandlers } from '../lib/handlers.js';
import { defaultCatalog, validateCatalog } from '../lib/validation.js';
import { authenticated } from '../lib/security.js';
import { MemoryStore } from './helpers.mjs';
const origin = 'https://escuela.example';
function fixture() {
  const env = { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: randomBytes(24).toString('hex'), SESSION_SECRET: randomBytes(40).toString('hex') };
  const store = new MemoryStore(); let clock = Date.now();
  const a = createHandlers({ store, env, storageConfigured: true, now: () => clock });
  const b = createHandlers({ store, env, storageConfigured: true, now: () => clock });
  const req = (path, method = 'GET', body, cookie = '', requestOrigin = origin) => new Request(origin + path, { method, headers: { origin: requestOrigin, 'content-type': 'application/json', cookie, 'x-escuela-client-ip': '192.0.2.10' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const login = async () => {
    const result = await a.session(req('/api/session', 'POST', { username: 'admin', password: env.ADMIN_PASSWORD }));
    assert.equal(result.status, 200);
    const cookie = result.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Strict/);
    return cookie.split(';')[0];
  };
  return { a, b, store, env, req, login, advance: ms => clock += ms };
}
test('changes to courses, reels, copy, combos and business options persist across independent instances', async () => {
  const f = fixture(); const cookie = await f.login();
  const initial = await (await f.a.catalog(f.req('/api/catalog'))).json();
  assert.equal(initial.data.courses.length, 8); assert.equal(initial.revision, null);
  const edited = structuredClone(initial.data);
  edited.courses[1].price = 355; edited.courses[1].date = '2027-01-18'; edited.courses[1].endDate = '2027-01-19';
  edited.courses[1].videos = [{ title: 'Facebook', url: 'https://www.facebook.com/reel/123456789/' }, { title: 'Instagram', url: 'https://www.instagram.com/reel/Abc_123-/' }];
  edited.courses[1].video = edited.courses[1].videos[0].url;
  edited.copy.heroDescription = 'Texto actualizado para todos'; edited.promotion.price = 350;
  edited.services[0].title = 'Servicio actualizado'; edited.incompanyCourses.push({ id: 'incompany-test', title: 'Nuevo taller', description: 'Taller para empresas', buttonLabel: 'Consultar', message: '', visible: true });
  const saved = await f.a.catalog(f.req('/api/catalog', 'PUT', { data: edited, revision: initial.revision }, cookie));
  assert.equal(saved.status, 200);
  const visitor = await (await f.b.catalog(f.req('/api/catalog'))).json();
  assert.equal(visitor.data.courses[1].price, 355); assert.equal(visitor.data.courses[1].date, '2027-01-18');
  assert.equal(visitor.data.courses[1].videos.length, 2); assert.equal(visitor.data.promotion.price, 350);
  assert.equal(visitor.data.copy.heroDescription, edited.copy.heroDescription); assert.equal(visitor.data.services[0].title, edited.services[0].title);
  assert.equal(visitor.data.incompanyCourses.length, edited.incompanyCourses.length);
});
test('rejects unauthenticated writes, forged cookies, cross-origin requests, and old demo credentials', async () => {
  const f = fixture(); const data = defaultCatalog();
  assert.equal((await f.a.catalog(f.req('/api/catalog', 'PUT', { data, revision: null }))).status, 401);
  assert.equal((await f.a.session(f.req('/api/session', 'POST', { username: 'admin', password: 'EscuelaIA2026!' }))).status, 401);
  const cookie = await f.login();
  assert.equal((await f.a.catalog(f.req('/api/catalog', 'PUT', { data, revision: null }, cookie, 'https://other.example'))).status, 401);
  assert.equal((await f.a.catalog(f.req('/api/catalog', 'PUT', { data, revision: null }, cookie + 'tampered'))).status, 401);
  const secretOutput = JSON.stringify(await (await f.a.session(f.req('/api/session'))).json());
  assert.ok(!secretOutput.includes(f.env.ADMIN_PASSWORD));
});
test('optimistic concurrency rejects stale saves and simultaneous first writes', async () => {
  const f = fixture(); const cookie = await f.login(); const data = defaultCatalog();
  const write = body => f.a.catalog(f.req('/api/catalog', 'PUT', body, cookie));
  const first = await write({ data, revision: null }); assert.equal(first.status, 200);
  assert.equal((await write({ data, revision: null })).status, 409);
  const revision = (await first.json()).revision;
  data.copy.heroDescription = 'Nuevo contenido'; assert.equal((await write({ data, revision })).status, 200);
  data.copy.heroDescription = 'Contenido antiguo'; assert.equal((await write({ data, revision })).status, 409);
});
test('storage errors do not report successful saves or silently replace published data with defaults', async () => {
  const f = fixture(); const cookie = await f.login(); f.store.fail = true;
  assert.equal((await f.a.catalog(f.req('/api/catalog'))).status, 503);
  assert.equal((await f.a.catalog(f.req('/api/catalog', 'PUT', { data: defaultCatalog(), revision: null }, cookie))).status, 503);
});
test('server validates imports, URL origins and oversized requests', async () => {
  const f = fixture(); const cookie = await f.login(); const data = defaultCatalog();
  data.courses[0].videos = [{ title: 'Inválido', url: 'https://facebook.com.evil.example/reel/123/' }];
  assert.equal((await f.a.catalog(f.req('/api/catalog', 'PUT', { data, revision: null }, cookie))).status, 400);
  const large = f.req('/api/catalog', 'PUT', { data: 'x'.repeat(3 * 1024 * 1024 + 1), revision: null }, cookie);
  assert.equal((await f.a.catalog(large)).status, 413);
  const duplicate = defaultCatalog(); duplicate.courses.push(duplicate.courses[0]); assert.throws(() => validateCatalog(duplicate));
});
test('login rate limit persists across instances and clears after the time window', async () => {
  const f = fixture();
  for (let i = 0; i < 8; i++) assert.equal((await (i % 2 ? f.a : f.b).session(f.req('/api/session', 'POST', { username: 'admin', password: 'wrong' }))).status, 401);
  assert.equal((await f.a.session(f.req('/api/session', 'POST', { username: 'admin', password: f.env.ADMIN_PASSWORD }))).status, 429);
  f.advance(16 * 60 * 1000); assert.ok(await f.login());
});
test('sessions expire, password rotation invalidates sessions, and logout clears cookie', async () => {
  const f = fixture(); const cookie = await f.login();
  assert.equal((await (await f.a.session(f.req('/api/session', 'GET', undefined, cookie))).json()).authenticated, true);
  const logout = await f.a.session(f.req('/api/session', 'DELETE', undefined, cookie)); assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  f.env.ADMIN_PASSWORD = randomBytes(20).toString('hex'); assert.equal(authenticated(f.req('/api/session', 'GET', undefined, cookie), f.env), false);
  const next = await f.login(); f.advance(9 * 3600 * 1000);
  assert.equal((await (await f.a.session(f.req('/api/session', 'GET', undefined, next))).json()).authenticated, false);
});
test('missing administrative settings block login and writes but leave the public catalogue readable', async () => {
  const f = fixture(); delete f.env.SESSION_SECRET;
  assert.equal((await f.a.catalog(f.req('/api/catalog'))).status, 200);
  const session=await (await f.a.session(f.req('/api/session'))).json();
  assert.equal(session.configured,false); assert.equal(session.setup.sessionSecret,false);
  assert.equal((await f.a.catalog(f.req('/api/catalog','PUT',{data:defaultCatalog(),revision:null}))).status,401);
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('EscuelaIA2026!')); assert.ok(!html.includes('save(KEY,data)')); assert.ok(!html.includes('Marcelo'));
  assert.match(html, /await publishCatalog/); assert.match(html, /setInterval\(refreshForVisitors,20000\)/);
});
