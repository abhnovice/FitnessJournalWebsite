import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';

const config={GEMINI_API_KEY:'gemini-test',GEMINI_MODEL:'test',GROQ_API_KEY:'groq-test'};
const nutrition={energy_kcal:100,protein_g:3,carbohydrate_g:18,fat_g:2};
const photo={image:'/9j/',mimeType:'image/jpeg'};
const match={is_food:true,matches:[{name:'Rice',reason:'Steamed grains'}]};
const dish={name:'Rice',ingredients:['rice'],preparation:'Steamed',grams:125,per100:nutrition};
function request(path,body){
  return worker.fetch(new Request('https://app.test/api/'+path,{method:'POST',
    headers:{'oai-authenticated-user-id':'tester','content-type':'application/json'},body:JSON.stringify(body)}),config);
}
const cases=[
  ['coach',{messages:[{role:'user',text:'Help me plan my week.'}]},{answer:'Choose a priority.'},r=>r.source],
  ['nutrition/search',{query:'rice',provider:'gemini'},match,r=>r.candidates[0].source],
  ['nutrition/confirm',{name:'rice',provider:'gemini'},{can_estimate:true,unit:'g',preparation:'Steamed',assumptions:'Plain',nutrition},r=>r.profile.source],
  ['nutrition/photo',photo,match,r=>r.candidates[0].source],
  ['nutrition/photo',{...photo,mode:'meal'},{meals:[{name:'Rice',location:'Center',box:[0,0,1000,1000],dishes:[dish]}]},r=>r.profile.source]
];
for(const [path,body,expected,source] of cases){
  test('Groq handles failed Gemini request for '+path+' '+(body.mode||''),async t=>{
    const hosts=[];
    t.mock.method(globalThis,'fetch',async(url,options)=>{
      const host=new URL(url).hostname;hosts.push(host);
      if(host==='generativelanguage.googleapis.com')return new Response(null,{status:429});
      assert.equal(host,'api.groq.com');
      assert.equal(options.headers.Authorization,'Bearer groq-test');
      const payload=JSON.parse(options.body);
      assert.equal(payload.response_format.type,'json_object');
      if(body.image)assert.equal(payload.messages[0].content.find(p=>p.type==='image_url').image_url.url,'data:image/jpeg;base64,/9j/');
      return Response.json({choices:[{message:{content:JSON.stringify(expected)}}]});
    });
    const response=await request(path,body);assert.equal(response.status,200);
    assert.match(source(await response.json()),/^Groq/);
    assert.deepEqual(hosts,['generativelanguage.googleapis.com','api.groq.com']);
  });
}
test('valid Gemini no-match and policy declines do not invoke Groq',async t=>{
  const responses=[{candidates:[{content:{parts:[{text:'{"is_food":false,"matches":[]}'}]}}]},
    {promptFeedback:{blockReason:'SAFETY'}}];
  t.mock.method(globalThis,'fetch',async url=>{
    assert.equal(new URL(url).hostname,'generativelanguage.googleapis.com');return Response.json(responses.shift());
  });
  assert.equal((await (await request('nutrition/photo',photo)).json()).source,'Gemini');
  assert.equal((await request('nutrition/photo',photo)).status,422);
});
test('invalid Gemini shape invokes Groq once and a second failure is handled',async t=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{
    calls++;return calls===1?Response.json({candidates:[{content:{parts:[{text:'{}'}]}}]}):new Response(null,{status:503});
  });
  const response=await request('coach',cases[0][1]);assert.equal(response.status,502);assert.equal(calls,2);
  assert.doesNotMatch(await response.text(),/groq-test|gemini-test/);
});
