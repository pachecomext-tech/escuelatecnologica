import { getStore } from '@netlify/blobs';

export function createNetlifyStore(open = () => getStore({ name: 'escuela-catalogo', consistency: 'strong' })) {
  return {
    async read(path) {
      const result = await open().getWithMetadata(path, { type: 'json', consistency: 'strong' });
      return result ? { value: result.data, revision: result.etag } : null;
    },
    async write(path, value, revision) {
      const result = await open().setJSON(path, value, revision ? { onlyIfMatch: revision } : { onlyIfNew: true });
      if (!result.modified || !result.etag) throw Object.assign(Error('Otra sesión cambió el catálogo.'), { name: 'BlobPreconditionFailedError' });
      return result.etag;
    },
  };
}
