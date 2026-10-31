// Preview only. Production uses api/*.js and the persistent private Blob store.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { createHandlers } from '../lib/handlers.js';
import { issueSession, sessionCookie } from '../lib/security.js';

const root = resolve(import.meta.dirname, '..');
const local = process.env.LOCAL_PREVIEW === '1';
if (!local) throw Error('Para una prueba local aislada, usa LOCAL_PREVIEW=1. La publicación real se ejecuta en Netlify.');
const env = { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: randomBytes(24).toString('hex'), SESSION_SECRET: randomBytes(40).toString('hex'), } ;
const localDir = join(root, '.dev-data');
let queue = Promise.resolve();
const diskStore = {
  async read(path) {
    try { return JSON.parse(await readFile(join(localDir, encodeURIComponent(path) + '.json'), 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  },
  async write(path, value, revision) {
    const operation = queue.then(async () => {
      const current = await this.read(path);
      if (current ? current.revision !== revision : Boolean(revision)) throw Object.assign(Error('Conflict'), { name: 'BlobPreconditionFailedError' });
      await mkdir(localDir, { recursive: true });
      const next = randomBytes(20).toString('hex');
      const destination = join(localDir, encodeURIComponent(path) + '.json');
      await writeFile(destination + '.tmp', JSON.stringify({ value, revision: next }));
      await rename(destination + '.tmp', destination);
      return next;
    });
    queue = operation.catch(() => {}); return operation;
  },
};
const handlers = createHandlers({ store: diskStore, env, storageConfigured: true });
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 4 * 1024 * 1024) { res.writeHead(413); res.end(); return; } chunks.push(chunk); }
    const request = new Request(url, { method: req.method, headers: req.headers, ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.concat(chunks) }) });
    if (url.pathname === '/qa-admin' && local && process.env.QA_ADMIN === '1') {
      res.writeHead(302, { Location: '/#admin', 'Set-Cookie': sessionCookie(issueSession(env), request) }); res.end(); return;
    }
    let result;
    if (url.pathname === '/api/catalog') result = await handlers.catalog(request);
    else if (url.pathname === '/api/session') result = await handlers.session(request);
    else if (url.pathname === '/' || url.pathname === '/index.html') result = new Response(await readFile(join(root, 'public/index.html')), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    else result = new Response('Not found', { status: 404 });
    res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(Buffer.from(await result.arrayBuffer()));
  } catch { res.writeHead(500); res.end('Preview error'); }
});
server.listen(Number(process.env.PORT || 4173), '0.0.0.0', () => {
  console.log(local ? 'Local preview running with isolated disk storage.' : 'Netlify API preview running.');

});
