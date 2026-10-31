import { createHandlers } from '../../lib/handlers.js';
import { createNetlifyStore } from '../../lib/netlify-store.js';
const handlers = createHandlers({ store: createNetlifyStore(), storageConfigured: true });
export default request => handlers.catalog(request);
