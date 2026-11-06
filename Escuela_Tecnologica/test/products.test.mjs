import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { defaultCatalog, validateCatalog, normalizeProducts } from '../lib/validation.js';
import { createHandlers } from '../lib/handlers.js';
import { MemoryStore } from './helpers.mjs';
import { issueSession } from '../lib/security.js';

test('products migration preserves every existing field and respects empty or edited catalogues', async()=>{
 const legacy=defaultCatalog();delete legacy.products;delete legacy.productSettings;
 legacy.courses[0].title='Mi título personalizado';legacy.courses[0].price=487;legacy.copy.heroFirst='Mi portada';
 const before=structuredClone(legacy),store=new MemoryStore();const revision=await store.write('escuela/catalog-v1.json',legacy,null);
 const h=createHandlers({store,storageConfigured:true});const response=await h.catalog(new Request('https://example.com/api/catalog'));
 const result=await response.json();assert.equal(result.revision,revision);assert.equal(result.data.products.length,3);assert.ok(result.data.products.every(p=>p.price===50&&p.videos.length===0));
 const {products,productSettings,...rest}=result.data;assert.deepEqual(rest,before);assert.deepEqual((await store.read('escuela/catalog-v1.json')).value,before);
 const empty={...before,products:[]};assert.deepEqual(normalizeProducts(empty).products,[]);
 products[0].price=75;assert.equal(normalizeProducts({...before,products}).products[0].price,75);
});
test('product title, price, image, single reel, visibility and copy survive authenticated shared save',async()=>{
 const env={ADMIN_USERNAME:'admin',ADMIN_PASSWORD:'test-password-long-enough',SESSION_SECRET:'test-secret-key-with-more-than-32-characters'};
 const store=new MemoryStore(),h=createHandlers({store,env,storageConfigured:true});const data=defaultCatalog();const oldCourses=structuredClone(data.courses);
 Object.assign(data.products[0],{price:75,title:'Mi mini app editada',image:'https://example.com/photo.webp',videos:[{title:'Presentación',url:'https://www.instagram.com/reel/ABC123/'}],visible:false});data.productSettings.title='Mis productos';
 const response=await h.catalog(new Request('https://example.com/api/catalog',{method:'PUT',headers:{origin:'https://example.com','content-type':'application/json',cookie:'escuela_admin='+issueSession(env)},body:JSON.stringify({data,revision:null})}));
 assert.equal(response.status,200);const saved=(await (await h.catalog(new Request('https://example.com/api/catalog'))).json()).data;
 assert.deepEqual(saved.products,data.products);assert.deepEqual(saved.courses,oldCourses);assert.equal(saved.productSettings.title,'Mis productos');
});
test('server rejects a second product video, invalid prices, duplicate ids and unsafe links',()=>{
 const mutate=fn=>{const d=defaultCatalog();fn(d);assert.throws(()=>validateCatalog(d))};
 mutate(d=>d.products[0].videos=[{title:'a',url:'https://www.instagram.com/reel/ABC123/'},{title:'b',url:'https://www.instagram.com/reel/DEF456/'}]);
 mutate(d=>d.products[0].price=-10);mutate(d=>d.products[0].videos=[{title:'x',url:'https://facebook.com.attacker.com/reel/123/'}]);mutate(d=>d.products[1].id=d.products[0].id);
 const d=defaultCatalog();d.products[0].price=null;assert.equal(validateCatalog(d).products[0].price,null);
});
test('product and course combo totals remain separate, product data is escaped, and HR draft is unpublished',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');let js=html.match(/<script>([\s\S]*?)<\/script>/)[1];js=js.slice(0,js.indexOf("window.addEventListener('beforeunload'"));
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{value:'',dataset:{},style:{},innerHTML:'',textContent:'',addEventListener(){},querySelectorAll(){return []},classList:{remove(){},add(){},toggle(){}}});return elements.get(id)};
 const context={document:{getElementById:element,querySelectorAll:()=>[],querySelector:()=>null},window:{scrollTo(){},scrollY:0},location:{hash:''},localStorage:{getItem:()=>null,setItem(){}},structuredClone,URL,setTimeout:()=>1,clearTimeout(){}};vm.createContext(context);vm.runInContext(js,context);
 vm.runInContext('cart=data.courses.slice(0,2).map(c=>c.id);comboIds=[...cart];productCart=[data.products[0].id];',context);
 assert.equal(vm.runInContext('pricing().total',context),300);assert.equal(vm.runInContext('productSubtotal()',context),50);assert.match(vm.runInContext('message("Ana")',context),/Total referencial: Bs 350/);
 assert.equal(vm.runInContext('comboItems().length',context),2);
 vm.runInContext("data.products[0].title='<script>alert(1)</script>';",context);assert.doesNotMatch(vm.runInContext('productCard(data.products[0])',context),/<script>/);
 const count=vm.runInContext('data.courses.length',context);vm.runInContext('adminSession=true;editor=()=>{};createCourseDraft(true)',context);
 assert.equal(vm.runInContext('data.courses.length',context),count);assert.equal(vm.runInContext('pendingCourse.price',context),null);assert.equal(vm.runInContext('pendingCourse.date',context),'');assert.equal(vm.runInContext('pendingCourse.title',context),'Recursos Humanos con IA');
});
