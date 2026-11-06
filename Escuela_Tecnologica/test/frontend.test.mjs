import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { defaultCatalog } from '../lib/validation.js';

function frontend() {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  let js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  js = js.slice(0, js.indexOf("window.addEventListener('beforeunload'"));
  const fields = new Map();
  const element = id => {
    if (!fields.has(id)) fields.set(id, { value: '', textContent: '', innerHTML: '', hidden: true, disabled: false, checked: false, dataset: {}, style: {}, reportValidity: () => true, querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} } });
    return fields.get(id);
  };
  let stored = defaultCatalog(), revision = null, writes = 0, fail = false;
  const context = {
    document: { getElementById: element, querySelectorAll: () => [], title: '' },
    window: { scrollY: 0, scrollTo() {} }, location: { hash: '' }, localStorage: { getItem: () => null, setItem() {} },
    structuredClone, URL, Blob, AbortSignal, setTimeout: () => 1, clearTimeout() {}, console, history: { replaceState() {} },
    fetch: async (url, options) => {
      if (fail) return Response.json({ error: 'Sin conexión al almacenamiento' }, { status: 503 });
      if (options.method === 'PUT') {
        const body = JSON.parse(options.body); assert.equal(body.revision, revision);
        stored = body.data; revision = 'rev-' + (++writes);
        return Response.json({ revision });
      }
      return Response.json({ data: structuredClone(stored), revision });
    },
  };
  vm.createContext(context); vm.runInContext(js, context);
  vm.runInContext("routeBehind=()=>{};toast=()=>{};adminSession=true;remoteReady=true;", context);
  return { context, fields, element, setFail: v => fail = v, stored: () => stored, writes: () => writes };
}
test('course editor awaits server response before reporting success; failures leave an exportable draft', async () => {
  const f = frontend(); const c = defaultCatalog().courses[0];
  const values = { 'brand-field': 'Escuela Tecnológica', 'wa-field': '59162301640', 'instructor-field': '', 'title-field': c.title, 'cat-field': c.cat, 'price-field': '280', 'date-field': c.date, 'enddate-field': c.endDate, 'start-field': c.start, 'end-field': c.end, 'hours-field': String(c.hours), 'tag-field': c.tag, 'delivery-label-field': c.deliveryLabel, 'desc-field': c.desc, 'intro-field': c.intro, 'video-field': 'https://www.facebook.com/reel/123456789/', 'video-field-1': 'https://www.instagram.com/reel/ABC_123/', 'video-field-2': '', 'video-title-0': 'Facebook', 'video-title-1': 'Instagram', 'video-title-2': '', 'image-field': '', 'outcomes-field': c.outcomes.join('\n'), 'modules-field': c.modules.map(m => m[0] + ' | ' + m[1].join(' ; ')).join('\n'), 'audience-field': c.audience, 'requirements-field': c.requirements, 'level-field': 'Inicial' };
  for (const [key, value] of Object.entries(values)) f.element(key).value = value;
  f.element('course-fields').dataset.id = c.id;
  assert.equal(await vm.runInContext('saveEditor()', f.context), true);
  assert.equal(f.stored().courses[0].price, 280); assert.equal(f.stored().courses[0].videos.length, 2);
  assert.match(f.element('cloud-status').textContent, /Cambios publicados/);
  f.setFail(true); f.element('price-field').value = '290';
  assert.equal(await vm.runInContext('saveEditor()', f.context), false);
  assert.equal(f.stored().courses[0].price, 280); assert.equal(f.writes(), 1);
  assert.match(f.element('cloud-status').textContent, /No se publicaron/);
  assert.equal(vm.runInContext('unsavedCloud', f.context), true);
});
test('promotion, copy and business editor saves use shared persistence', async () => {
  const f = frontend(); const base = defaultCatalog();
  f.element('promo-price').value = '320';
  for (const [key, value] of Object.entries(base.promotion)) if (key !== 'price') f.element('promo-' + key).value = value;
  assert.equal(await vm.runInContext('saveContentEditor(true)', f.context), true);
  assert.equal(f.stored().promotion.price, 320);
  for (const [key, value] of Object.entries(base.copy)) f.element('copy-' + key).value = value;
  f.element('copy-heroDescription').value = 'Descripción publicada para todos';
  f.element('facebook-url').value = base.facebook;
  assert.equal(await vm.runInContext('saveContentEditor(false)', f.context), true);
  assert.equal(f.stored().copy.heroDescription, 'Descripción publicada para todos');
  vm.runInContext("data.services[0].title='Servicio compartido'", f.context);
  assert.equal(await vm.runInContext('publishCatalog()', f.context), true);
  assert.equal(f.stored().services[0].title, 'Servicio compartido');
});
