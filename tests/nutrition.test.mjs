import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {handleNutrition,validateEntry,entryTotals,frequentFoods} from '../src/nutrition.mjs';
import {database} from '../scripts/sqlite-d1.mjs';
const dir=mkdtempSync(join(tmpdir(),'best-life-test-'));after(()=>rmSync(dir,{recursive:true,force:true}));
const DB=database(join(dir,'test.sqlite'));DB.migrate();
const request=(path,method='GET',body,user='alice',env={DB})=>handleNutrition(new Request('https://example.test/api/nutrition/'+path,{method,headers:{...(user?{'oai-authenticated-user-id':user}:{}),'content-type':'application/json'},body:body?JSON.stringify(body):undefined}),env);
const food={id:'portion-0001',date:'2026-11-09',name:'Paneer',meal:'Lunch',unit:'g',quantity:150,nutrition:{energy_kcal:250,protein_g:18,carbohydrate_g:3,fat_g:19},source:'Manual package entry',is_estimate:false};
test('authentication and invalid diary dates are rejected',async()=>{assert.equal((await request('entries?date=2026-11-09','GET',null,null)).status,401);assert.equal((await request('entries?date=2026-02-30')).status,400);assert.equal((await request('entries?date=undefined')).status,400);});
test('portion scaling, persistent totals, idempotent save, date and user isolation',async()=>{
  assert.deepEqual(entryTotals(food),{energy_kcal:375,protein_g:27,carbohydrate_g:4.5,fat_g:28.5});
  assert.equal((await request('entries','POST',food)).status,200);await request('entries','POST',food);
  const saved=await(await request('entries?date=2026-11-09')).json();assert.equal(saved.entries.length,1);assert.equal(saved.totals.energy_kcal,375);
  const reloadedDB=database(join(dir,'test.sqlite'));assert.equal((await(await request('entries?date=2026-11-09','GET',null,'alice',{DB:reloadedDB})).json()).entries.length,1);
  assert.equal((await(await request('entries?date=2026-11-10')).json()).totals.energy_kcal,0);
  assert.equal((await(await request('entries?date=2026-11-09','GET',null,'bob')).json()).entries.length,0);
  await request('entries?date=2026-11-09&id=portion-0001','DELETE',null,'bob');assert.equal((await(await request('entries?date=2026-11-09')).json()).entries.length,1);
  await request('entries?date=2026-11-09&id=portion-0001','DELETE');assert.equal((await(await request('entries?date=2026-11-09')).json()).totals.energy_kcal,0);
});
test('invalid portions and missing macros are never saved as zero',async()=>{
  for(const bad of [{quantity:-5},{quantity:0},{quantity:Infinity},{nutrition:{...food.nutrition,protein_g:null}},{nutrition:{...food.nutrition,energy_kcal:1200}},{date:'2026-02-30'},{name:' '},{meal:'Other'}])assert.equal(validateEntry({...food,...bad}),false);
  assert.equal((await request('entries','POST',{...food,quantity:0})).status,400);
  assert.equal(entryTotals({...food,unit:'ml',quantity:250}).energy_kcal,625);
});
test('food confirmation labels estimates and rejects missing API configuration',async()=>{
  assert.equal((await request('confirm','POST',{name:'Tea'},'alice',{})).status,503);
  const original=globalThis.fetch;globalThis.fetch=async(url,options)=>{
    assert.equal(options.headers['x-goog-api-key'],'test-only-key');assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'));
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({can_estimate:true,unit:'ml',preparation:'Brewed unsweetened tea',assumptions:'No milk or sugar',nutrition:{energy_kcal:1,protein_g:0,carbohydrate_g:0.2,fat_g:0}})}]}}]});
  };
  try{const response=await request('confirm','POST',{name:'Tea'},'alice',{GEMINI_API_KEY:'test-only-key',GEMINI_MODEL:'gemini-test-flash'});const result=await response.json();assert.equal(response.status,200);assert.equal(result.profile.is_estimate,true);assert.equal(result.profile.unit,'ml');assert.ok(!JSON.stringify(result).includes('test-only-key'));}finally{globalThis.fetch=original;}
});
test('barcode identification never invents missing package nutrition; provider errors are redacted',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async(url)=>url.includes('barcodelookup')?Response.json({products:[{barcode_number:'8901234567890',title:'Test product'}]}):Response.json({status:1,product:{product_name:'Test product',nutriments:{},nutrition_data_per:'100g'}});
  try{let data=await(await request('search','POST',{query:'8901234567890'},'alice',{BARCODE_API:'test-secret'})).json();assert.equal(data.found,true);assert.equal(data.profile,undefined);assert.ok(data.message.includes('manually'));
    globalThis.fetch=async()=>new Response('secret upstream response',{status:403});data=await(await request('search','POST',{query:'8901234567890'},'alice',{BARCODE_API:'test-secret'})).json();assert.equal(data.found,false);assert.ok(data.warnings.length);assert.ok(!JSON.stringify(data).includes('test-secret'));assert.ok(!JSON.stringify(data).includes('secret upstream response'));
  }finally{globalThis.fetch=original;}
});
test('barcode nutrition remains available if identification provider is unavailable',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async(url)=>url.includes('barcodelookup')?new Response('',{status:429}):Response.json({status:1,product:{product_name:'Milk',nutrition_data_per:'100ml',nutriments:{'energy-kcal_100g':60,proteins_100g:3,carbohydrates_100g:5,fat_100g:3}}});
  try{const data=await(await request('search','POST',{query:'8901234567890'},'alice',{BARCODE_API:'test-only'})).json();assert.equal(data.profile.unit,'ml');assert.equal(data.profile.is_estimate,false);assert.equal(data.profile.nutrition.energy_kcal,60);assert.ok(data.warnings[0].includes('quota'));}finally{globalThis.fetch=original;}
});
test('November plan dates match launchpad, actual weekends and rendered bundle',async()=>{
  const page=readFileSync('src/journal.html','utf8');assert.ok(page.includes('Date.UTC(2026,10,11+offset)'));assert.ok(page.includes('9–10 November'));assert.ok(page.includes('9 Nov 2026 – 20 Feb 2028'));assert.ok(page.includes('(date(start+i).getUTCDay()+6)%7'));
  const worker=(await import('../dist/server/index.js')).default;
  const response=await worker.fetch(new Request('https://example.test/nutrition'),{});assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes('Your daily nutrition'));assert.ok(!html.includes('__JOURNAL_HTML__'));assert.equal((await worker.fetch(new Request('https://example.test/api/nutrition/entries?date=2026-11-09'),{})).status,401);
});

test('existing medical uploads and diet adherence remain available',async()=>{
  const worker=(await import('../dist/server/index.js')).default;
  const headers={'oai-authenticated-user-id':'regression-user','content-type':'application/json'};
  const record={version:2,checked:{},rewards:{claimed:{},custom:{},locked:{}},notes:{},weekly:{},measurements:[],shownMilestones:{},nutrition:{adherence:{'2026-11-09':true}}};
  assert.equal((await worker.fetch(new Request('https://example.test/api/progress',{method:'PUT',headers,body:JSON.stringify({record})}),{DB})).status,400);
  assert.equal((await worker.fetch(new Request('https://example.test/api/progress',{method:'PUT',headers,body:JSON.stringify(record)}),{DB})).status,200);
  const progress=await(await worker.fetch(new Request('https://example.test/api/progress',{headers}),{DB})).json();
  assert.equal(progress.record.nutrition.adherence['2026-11-09'],true);
  const files=await worker.fetch(new Request('https://example.test/api/medical-documents',{headers}),{DB,BUCKET:{}});
  assert.equal(files.status,200);assert.deepEqual((await files.json()).documents,[]);
  const page=await(await worker.fetch(new Request('https://example.test/nutrition'),{})).text();
  assert.ok(page.includes('Repeatable high-protein base'));assert.ok(page.includes('medical-form'));assert.ok(page.includes('Your daily nutrition'));
});

test('existing icons and credential redirect protection survive packaging',async()=>{
  const worker=(await import('../dist/server/index.js')).default;
  for(const path of ['/stronger-self-icon.webp','/favicon.svg','/face-icon.png','/pwa-icon-192.png']) {
    const r=await worker.fetch(new Request('https://example.test'+path),{});assert.equal(r.status,200);assert.ok((await r.arrayBuffer()).byteLength>0);
  }
  const original=globalThis.fetch;let calls=0;globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{location:'https://untrusted.invalid/'}});};
  try{const r=await request('search','POST',{query:'chapati'},'alice',{GEMINI_API_KEY:'test-only'});assert.equal(r.status,502);assert.ok((await r.json()).error.includes('unexpected redirect'));assert.equal(calls,1);}finally{globalThis.fetch=original;}
});

test('frequent foods rank repeat entries and preserve the latest profile and portion',()=>{
  const updated={...food,id:'updated-001',date:'2026-11-11',quantity:200,nutrition:{...food.nutrition,energy_kcal:280}};
  const foods=frequentFoods([updated,{...food,id:'other-001',name:'Milk',unit:'ml'},food,{...food,id:'old-0001',name:' paneer '}]);
  assert.equal(foods[0].uses,3);assert.equal(foods[0].quantity,200);assert.equal(foods[0].nutrition.energy_kcal,280);assert.equal(foods[0].is_estimate,false);
  assert.equal(frequentFoods([{...food,unit:'ml'},food]).length,2);
});
test('saved-food history survives a fresh database connection and is account-scoped',async()=>{
  await request('entries','POST',{...food,id:'favourite-001'},'food-cache-user');
  await request('entries','POST',{...food,id:'favourite-002',date:'2026-11-10',quantity:250},'food-cache-user');
  await request('entries','POST',{...food,id:'favourite-002',date:'2026-11-10',quantity:250},'food-cache-user');
  const fresh=database(join(dir,'test.sqlite'));
  const response=await request('foods','GET',null,'food-cache-user',{DB:fresh});assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.foods.length,1);assert.equal(data.foods[0].uses,2);assert.equal(data.foods[0].quantity,250);
  assert.deepEqual((await(await request('foods','GET',null,'another-account')).json()).foods,[]);
  assert.equal((await request('foods','GET',null,null)).status,401);
});
test('food photo validation prevents unsupported and mismatched uploads',async()=>{
  for(const body of [{image:'invalid!',mimeType:'image/jpeg'},{image:'AAAA',mimeType:'image/svg+xml'},{image:'AAAA',mimeType:'image/jpeg'},{image:'',mimeType:'image/png'}])assert.equal((await request('photo','POST',body,'alice',{})).status,400);
  assert.equal((await request('photo','POST',{image:'A'.repeat(4200000),mimeType:'image/jpeg'},'alice',{})).status,413);
});
test('photo suggestions require food confirmation and do not infer portion or macros',async()=>{
  const original=globalThis.fetch;let received;
  globalThis.fetch=async(url,options)=>{received=JSON.parse(options.body);return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({is_food:true,matches:[{name:'Roti',reason:'Flatbread in the picture'}]})}]}}]});};
  try{
    const image=btoa('\xff\xd8\xff'+'test picture');
    const response=await request('photo','POST',{image,mimeType:'image/jpeg'},'alice',{GEMINI_API_KEY:'photo-test-key',GEMINI_MODEL:'gemini-test-flash'});
    const data=await response.json();assert.equal(response.status,200);assert.equal(data.candidates[0].name,'Roti');assert.equal(data.profile,undefined);assert.equal(data.candidates[0].nutrition,undefined);
    assert.equal(received.contents[0].parts[1].inlineData.data,image);assert.equal(received.contents[0].parts[1].inlineData.mimeType,'image/jpeg');
    assert.ok(!JSON.stringify(data).includes(image));
  }finally{globalThis.fetch=original;}
});
test('barcode reader is bundled with the Worker rather than a runtime CDN dependency',async()=>{
  const worker=(await import('../dist/server/index.js')).default;
  const response=await worker.fetch(new Request('https://example.test/barcode-reader.js'),{});assert.equal(response.status,200);assert.ok(response.headers.get('content-type').includes('javascript'));assert.ok((await response.text()).includes('decodeFromCanvas'));
});
