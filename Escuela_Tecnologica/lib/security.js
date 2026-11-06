import { createHmac, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'escuela_admin';
const HOURS = 8 * 60 * 60;
export function configuration(env = process.env) {
  const password = typeof env.ADMIN_PASSWORD === 'string' && env.ADMIN_PASSWORD.length >= 16 && env.ADMIN_PASSWORD.length <= 256;
  const sessionSecret = typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.length >= 32;
  return {
    auth: password && sessionSecret,
    password,
    sessionSecret,
    problems: [!password && 'ADMIN_PASSWORD debe tener entre 16 y 256 caracteres', !sessionSecret && 'SESSION_SECRET debe tener al menos 32 caracteres'].filter(Boolean),
  };
}
const equal = (a, b) => a.length === b.length && timingSafeEqual(a, b);
export function credentialsMatch(username, password, env = process.env) {
  if (!configuration(env).auth || typeof password !== 'string' || password.length > 256) return false;
  const expected = scryptSync(env.ADMIN_PASSWORD, env.SESSION_SECRET, 64);
  const provided = scryptSync(password, env.SESSION_SECRET, 64);
  const userOK = equal(createHash('sha256').update(String(username).trim()).digest(), createHash('sha256').update((env.ADMIN_USERNAME || 'admin').trim()).digest());
  return equal(expected, provided) && userOK;
}
function signature(payload, env) {
  return createHmac('sha256', env.SESSION_SECRET).update(payload + ':' + createHash('sha256').update(env.ADMIN_PASSWORD).digest('hex')).digest('base64url');
}
export function issueSession(env = process.env, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + HOURS, nonce: randomBytes(20).toString('base64url') })).toString('base64url');
  return payload + '.' + signature(payload, env);
}
export function authenticated(request, env = process.env, now = Date.now()) {
  if (!configuration(env).auth) return false;
  const token = (request.headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!token || token.length > 1024) return false;
  try {
    const [payload, sig, extra] = token.split('.');
    if (extra || !sig || !equal(Buffer.from(sig), Buffer.from(signature(payload, env)))) return false;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return Number.isInteger(parsed.exp) && parsed.exp > now / 1000 && parsed.exp <= now / 1000 + HOURS + 10;
  } catch { return false; }
}
export function sessionCookie(token, request, clear = false) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : HOURS}${secure}`;
}
export function sameOrigin(request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}
export function json(value, status = 200, headers = {}) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}
export async function bodyJSON(request, limit = 3 * 1024 * 1024) {
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) throw Object.assign(Error('Usa contenido JSON.'), { status: 415 });
  if (Number(request.headers.get('content-length') || 0) > limit) throw Object.assign(Error('El catálogo supera 3 MB. Reduce las imágenes subidas o utiliza enlaces HTTPS.'), { status: 413 });
  const reader = request.body?.getReader();
  let size = 0; const chunks = [];
  if (!reader) throw Object.assign(Error('Faltan los datos.'), { status: 400 });
  while (true) {
    const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength;
    if (size > limit) { await reader.cancel(); throw Object.assign(Error('El catálogo supera 3 MB. Reduce las imágenes subidas o utiliza enlaces HTTPS.'), { status: 413 }); }
    chunks.push(Buffer.from(part.value));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(Error('Los datos no tienen un formato válido.'), { status: 400 }); }
}
