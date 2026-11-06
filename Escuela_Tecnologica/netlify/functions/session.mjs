import { createHandlers } from '../../lib/handlers.js';
import { createNetlifyStore } from '../../lib/netlify-store.js';
const handlers = createHandlers({ store: createNetlifyStore(), storageConfigured: true });
export default (request, context) => {
  const headers = new Headers(request.headers);
  // Use Netlify's verified client address, not a caller-supplied proxy header.
  headers.set('x-escuela-client-ip', context.ip || 'unknown');
  return handlers.session(new Request(request, { headers }));
};
