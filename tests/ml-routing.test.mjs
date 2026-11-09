import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {handleNutrition} from '../src/nutrition.mjs';
import {lookupFoods,lookupNutrition} from '../src/food-lookup.mjs';
import {acceptImage} from '../src/ml-core.mjs';
import {handleMLAsset} from '../src/ml-assets.mjs';
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});
const env={GEMINI_MODEL:'unchanged-model',GEMINI_API_KEY:'private-test-key'};
const request=(path,body)=>handleNutrition(new Request('https://site.example/api/nutrition/'+path,{method:'POST',headers:{'oai-authenticated-user-id':'alice','content-type':'application/json'},body:JSON.stringify(body)}),env);
test('workbook text matching skips Gemini and labels similarity honestly',async()=>{
  globalThis.fetch=()=>{throw Error('Must not call Gemini');};
  const data=await(await request('search',{query:'Chapati/Roti'})).json();
  assert.equal(data.candidates[0].source,'ML');assert.equal(data.candidates[0].name,'Chapati/Roti');assert.ok(data.candidates[0].confidence>.6);assert.equal(data.candidates[0].score_kind,'name similarity');
});
test('unmatched names call Gemini as fallback with explicit tag',async()=>{
  let calls=0;globalThis.fetch=async url=>{calls++;assert.match(String(url),/generativelanguage/);return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({is_food:true,matches:[{name:'A new dish',reason:'Generic suggestion'}]})}]}}]});};
  const data=await(await request('search',{query:'unlisted-food-xyzzy'})).json();assert.equal(data.candidates[0].source,'Gemini');assert.equal(calls,1);
});
test('confirmed exact workbook profile skips Gemini',async()=>{
  globalThis.fetch=()=>{throw Error('Must not call Gemini');};
  const data=await(await request('confirm',{name:'Chapati/Roti'})).json();assert.match(data.profile.source,/^ML/);assert.equal(data.profile.is_estimate,false);assert.ok(data.profile.nutrition.energy_kcal>0);
});
test('a similar recipe never replaces the confirmed food nutrition',()=>{assert.equal(lookupNutrition('roti'),null);assert.ok(lookupFoods('roti').length>0);});
for(const confidence of [.6,.59,NaN,Infinity])test('photo confidence '+confidence+' rejects ML',()=>{assert.equal(acceptImage({top:0,confidence,distance:0},{top:0},1),false);});
test('photo model also requires crop agreement and trained-image similarity',()=>{
  assert.equal(acceptImage({top:0,confidence:.61,distance:.9},{top:0},1),true);
  assert.equal(acceptImage({top:0,confidence:.99,distance:0},{top:1},1),false);
  assert.equal(acceptImage({top:0,confidence:.99,distance:1.01},{top:0},1),false);
});
test('model asset upload accepts only a known size and SHA-256',async()=>{
  const raw=new TextEncoder().encode('model'),sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',raw))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const manifest={version:'v1',assets:{'test.bin':{size:raw.length,sha256:sha,type:'application/octet-stream'}}};
  let saved=false;const storage={BUCKET:{put:async()=>{saved=true;}}};
  const put=body=>new Request('https://site.example/ml-assets/v1/test.bin',{method:'PUT',headers:{'content-length':'5'},body});
  assert.equal((await handleMLAsset(put('wrong'),storage,manifest)).status,400);assert.equal(saved,false);
  assert.equal((await handleMLAsset(put(raw),storage,manifest)).status,204);assert.equal(saved,true);
  assert.equal((await handleMLAsset(new Request('https://site.example/ml-assets/v1/unknown.bin'),storage,manifest)).status,404);
});
