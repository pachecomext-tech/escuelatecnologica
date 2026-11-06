import test from 'node:test';
import assert from 'node:assert/strict';
import { createNetlifyStore } from '../lib/netlify-store.js';
import { createHandlers } from '../lib/handlers.js';
import { defaultCatalog } from '../lib/validation.js';
import { issueSession } from '../lib/security.js';
import { randomBytes } from 'node:crypto';

test('Netlify adapter uses consistent reads and atomic conditional writes', async () => {
  let current = null, sequence = 0;
  const native = {
    async getWithMetadata(key, options) { assert.equal(options.consistency, 'strong'); assert.equal(options.type, 'json'); return current && structuredClone(current); },
    async setJSON(key, data, options) {
      if (current ? options.onlyIfMatch !== current.etag : !options.onlyIfNew) return { modified: false };
      current = { data: structuredClone(data), etag: 'netlify-' + (++sequence) };
      return { modified: true, etag: current.etag };
    },
  };
  const store = createNetlifyStore(() => native);
  assert.equal(await store.read('catalog'), null);
  assert.equal(await store.write('catalog', { title: 'Primero' }), 'netlify-1');
  await assert.rejects(store.write('catalog', { title: 'Viejo' }), { name: 'BlobPreconditionFailedError' });
  const read = await store.read('catalog'); assert.equal(read.value.title, 'Primero');
  assert.equal(await store.write('catalog', { title: 'Nuevo' }, read.revision), 'netlify-2');
  await assert.rejects(store.write('catalog', { title: 'Desactualizado' }, read.revision));
  assert.equal((await store.read('catalog')).value.title, 'Nuevo');
  const env = { ADMIN_PASSWORD: randomBytes(24).toString('hex'), SESSION_SECRET: randomBytes(40).toString('hex') };
  const handlers = createHandlers({ store, env, storageConfigured: true });
  const request = new Request('https://escuela.example/api/catalog', { method: 'PUT', headers: { origin: 'https://escuela.example', 'content-type': 'application/json', cookie: 'escuela_admin=' + issueSession(env) }, body: JSON.stringify({ data: defaultCatalog(), revision: 'netlify-2' }) });
  assert.equal((await handlers.catalog(request)).status, 200);
});
