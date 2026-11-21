import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {default:worker}=await import('../dist/server/index.js');
const req=(body,user=true)=>new Request('https://example.com/api/coach',{method:'POST',headers:{'content-type':'application/json',...(user?{'oai-authenticated-user-id':'test'}:{})},body:JSON.stringify(body)});
test('coach requires identity and validates bounded conversations',async()=>{
 assert.equal((await worker.fetch(req({},false),{})).status,401);
 assert.equal((await worker.fetch(req({messages:[]}),{})).status,400);
 assert.equal((await worker.fetch(req({messages:[{role:'system',text:'hi'}]}),{})).status,400);
});
test('coach returns provider answer and keeps errors private',async()=>{
 const original=globalThis.fetch;
 try{globalThis.fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({answer:'Pick one achievable step today.'})}]}}]}));
 let r=await worker.fetch(req({messages:[{role:'user',text:'Help me prioritize.'}]}),{GEMINI_API_KEY:'secret-test',GEMINI_MODEL:'gemini-test'});
 assert.equal(r.status,200);assert.equal((await r.json()).answer,'Pick one achievable step today.');
 globalThis.fetch=async()=>{throw Error('secret-test');};
 r=await worker.fetch(req({messages:[{role:'user',text:'Hello'}]}),{GEMINI_API_KEY:'secret-test',GEMINI_MODEL:'gemini-test'});
 assert.equal(r.status,502);assert.ok(!(await r.text()).includes('secret-test'));
 }finally{globalThis.fetch=original;}
});
