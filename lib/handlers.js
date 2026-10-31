import { createHash } from 'node:crypto';
import { authenticated, bodyJSON, configuration, credentialsMatch, issueSession, json, sameOrigin, sessionCookie } from './security.js';
import { validateCatalog, defaultCatalog } from './validation.js';
import { conflict } from './store.js';

const CATALOG = 'escuela/catalog-v1.json';
// Stored in Blob rather than instance memory: applies across serverless instances.
async function allowLogin(request, store, env, now) {
  const ip = request.headers.get('x-escuela-client-ip') || 'unknown';
  const hashed = createHash('sha256').update(env.SESSION_SECRET + ':' + ip).digest('hex');
  const window = Math.floor(now / (15 * 60 * 1000));
  const key = `escuela/security/login-${hashed}.json`;
  for (let retry = 0; retry < 4; retry++) {
    const current = await store.read(key);
    const count = current?.value.window === window ? current.value.count : 0;
    if (count >= 8) return false;
    try { await store.write(key, { window, count: count + 1 }, current?.revision); return true; }
    catch (error) { if (!conflict(error)) throw error; }
  }
  return false;
}
export function createHandlers({ store, env = process.env, now = () => Date.now(), storageConfigured = false }) {
  const configured = () => configuration(env).auth && storageConfigured;
  function failure(error) {
    return json({ error: error.status ? error.message : 'No se pudo conectar con el catálogo. Intenta nuevamente.' }, error.status || 503);
  }
  return {
    async session(request) {
      if (request.method === 'GET') {
        const c = configuration(env);
        return json({ authenticated: authenticated(request, env, now()), configured: configured(), release: 'netlify-2026-10-31-r2', setup: { password: c.password, sessionSecret: c.sessionSecret, problems: [...c.problems, ...(!storageConfigured ? ['Falta activar el almacenamiento del sitio'] : [])] } });
      }
      if (!['POST', 'DELETE'].includes(request.method)) return json({ error: 'Método no permitido.' }, 405);
      if (!sameOrigin(request)) return json({ error: 'Origen no permitido.' }, 403);
      if (request.method === 'DELETE') return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', request, true) });
      if (!configured()) return json({ error: 'Configuración pendiente en Netlify. '+configuration(env).problems.join('. ')+'. Guarda las variables con alcance Functions en Production y realiza un nuevo deploy.' }, 503);
      try {
        const body = await bodyJSON(request, 4096);
        if (!await allowLogin(request, store, env, now())) return json({ error: 'Demasiados intentos. Espera 15 minutos antes de volver a ingresar.' }, 429, { 'Retry-After': '900' });
        if (!credentialsMatch(body.username, body.password, env)) return json({ error: 'Usuario o contraseña incorrectos. Usa ADMIN_PASSWORD guardada en Netlify, no SESSION_SECRET. Si cambiaste las variables, vuelve a desplegar.' }, 401);
        return json({ authenticated: true }, 200, { 'Set-Cookie': sessionCookie(issueSession(env, now()), request) });
      } catch (error) { return failure(error); }
    },
    async catalog(request) {
      if (!['GET', 'PUT'].includes(request.method)) return json({ error: 'Método no permitido.' }, 405);
      if (request.method === 'PUT' && (!sameOrigin(request) || !authenticated(request, env, now()))) return json({ error: 'Inicia sesión como administrador para guardar.' }, 401);
      if (!storageConfigured) return json({ error: 'El catálogo aún está pendiente de activación.' }, 503);
      try {
        if (request.method === 'GET') {
          const saved = await store.read(CATALOG);
          return json({ data: saved?.value || defaultCatalog(), revision: saved?.revision || null });
        }
        const body = await bodyJSON(request);
        if (!(body.revision === null || typeof body.revision === 'string')) return json({ error: 'Recarga el catálogo antes de guardar.' }, 400);
        let data;
        try { data = validateCatalog(body.data); } catch { return json({ error: 'Revisa los datos: el catálogo contiene un campo inválido.' }, 400); }
        try {
          const revision = await store.write(CATALOG, data, body.revision);
          return json({ revision, updatedAt: new Date(now()).toISOString() });
        } catch (error) {
          if (conflict(error)) return json({ error: 'Otra sesión actualizó el catálogo. Exporta tus cambios y recarga la página antes de continuar.' }, 409);
          throw error;
        }
      } catch (error) { return failure(error); }
    },
  };
}
