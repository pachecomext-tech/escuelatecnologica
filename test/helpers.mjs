import { createHash } from 'node:crypto';
export class MemoryStore {
  values = new Map();
  counter = 0;
  fail = false;
  async read(path) {
    if (this.fail) throw Error('Storage unavailable');
    const entry = this.values.get(path);
    return entry ? structuredClone(entry) : null;
  }
  async write(path, value, revision) {
    if (this.fail) throw Error('Storage unavailable');
    const current = this.values.get(path);
    if ((current && revision !== current.revision) || (!current && revision)) throw Object.assign(Error('Conflict'), { name: current ? 'BlobPreconditionFailedError' : 'BlobAlreadyExistsError' });
    const next = 'test-revision-' + (++this.counter) + '-' + createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 8);
    this.values.set(path, { value: structuredClone(value), revision: next });
    return next;
  }
}
