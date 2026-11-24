import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {database} from '../scripts/sqlite-d1.mjs';
import {previewProofBucket} from '../scripts/preview-proofs.mjs';
import {diaryChecklist,portionTargets} from '../src/baseline.mjs';
import worker from '../dist/server/index.js';

test('photo diary and checklist share one record, portion size, removal and finalization',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'integrated-diary-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const env={DB:database(join(dir,'data.sqlite')),BUCKET:previewProofBucket(dir),GEMINI_MODEL:'test',GEMINI_API_KEY:'test'};
  env.DB.migrate();
  const api=(path,method='GET',body,user='one')=>worker.fetch(new Request('https://example.test/api/nutrition/'+path,{method,headers:{'oai-authenticated-user-id':user,'content-type':'application/json'},body:body&&JSON.stringify(body)}),env);
  const day='2026-11-24',query='?date='+day;
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({matches:[{food:'eggs',servings:1}],extras:[{name:'toast',servings:1}]})}]}}]});});
  const e={id:'photo-test-1',date:day,meal:'Snack',autoMeal:true,name:'Eggs and toast',source:'Gemini meal photo',unit:'g',quantity:100,is_estimate:true,nutrition:{energy_kcal:200,protein_g:15,carbohydrate_g:10,fat_g:10},photo:{image:'/9j/',originalQuantity:200,location:'left plate'}};
  for(let i=0;i<2;i++)assert.equal((await api('entries','POST',e)).status,200);
  assert.equal(calls,1);
  let data=await(await api('entries'+query)).json();
  assert.equal(data.entries.length,1);assert.equal(data.entries[0].meal,'Breakfast');assert.equal(data.totals.energy_kcal,200);
  assert.equal(data.checklist.portions.eggs,0.5);assert.deepEqual(data.checklist.extras,[{name:'toast',servings:0.5}]);
  assert.equal(data.finalized,false);
  assert.equal((await api('diary-photo'+query+'&id='+e.id)).status,200);
  assert.equal((await api('diary-photo'+query+'&id='+e.id,'GET',null,'two')).status,404);
  assert.equal((await(await api('diary-score'+query,'POST')).json()).finalized,true);
  assert.equal((await(await api('entries'+query)).json()).finalized,true);
  const manual={...e,id:'manual-001',name:'Bananas',photo:undefined,planRole:'planned'};
  await api('entries','POST',manual);
  data=await(await api('entries'+query)).json();assert.equal(data.finalized,false);assert.equal(data.checklist.portions.bananas,0);
  assert.deepEqual(data.checklist.unverified,['Bananas']);
  await api('entries'+query+'&id='+e.id,'DELETE');
  data=await(await api('entries'+query)).json();assert.equal(data.checklist.portions.eggs,0);assert.equal(data.checklist.extras.length,0);
  assert.equal((await api('diary-photo'+query+'&id='+e.id)).status,404);
});

test('score distinguishes full plan, missing quantities, additional foods and surplus portions',()=>{
 const matches=Object.keys(portionTargets).map(food=>({food,servings:1}));
 const evidence={matches,extras:[]};
 assert.equal(diaryChecklist([{evidence}]).score,100);
 assert.equal(diaryChecklist([{evidence},{name:'Jalebi',planRole:'extra'}]).score,91);
 matches[0].servings=0.5;assert.equal(diaryChecklist([{evidence}]).score,96);
 matches[0].servings=2;assert.equal(diaryChecklist([{evidence}]).score,91);
});
