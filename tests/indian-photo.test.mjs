import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleNutrition,entryTotals} from '../src/nutrition.mjs';
import {lookupFoods} from '../src/food-lookup.mjs';
import {replacePhotoDish,vegetableLookalike} from '../src/photo-review.mjs';
const nutrition=(energy_kcal,carbohydrate_g)=>({energy_kcal,carbohydrate_g,protein_g:2,fat_g:1});
const request=(path,body)=>handleNutrition(new Request('https://test.example/api/nutrition/'+path,{
  method:'POST',headers:{'oai-authenticated-user-id':'tester'},body:JSON.stringify(body)
}),{GEMINI_API_KEY:'test',GEMINI_MODEL:'test'});
test('a vegetable name cannot match another ingredient just because the dishes are sabzis',()=>{
  assert.ok(lookupFoods('papita ki sabzi').every(food=>/papaya/i.test(food.name)));
  assert.deepEqual(lookupFoods('aloo ki sabzi').map(food=>food.name),['Potato curry (Aloo ki sabzi)']);
  assert.ok(vegetableLookalike('Vazhakkai poriyal'));
  assert.ok(!vegetableLookalike('masoor dal'));
});
test('correcting potato to green papaya changes only that part of the meal and supports scaled portions',async t=>{
  const original={name:'Potato sabzi',ingredients:['potato','cumin'],preparation:'Pan cooked',grams:100,per100:nutrition(120,18)};
  const rice={name:'Rice',ingredients:['rice'],preparation:'Steamed',grams:150,per100:nutrition(130,28)};
  const corrected={name:'Green papaya sabzi',ingredients:['green papaya','cumin'],preparation:'Pan cooked',per100:nutrition(70,8)};
  let calls=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    const prompt=JSON.parse(options.body).contents[0].parts[0].text;
    const first=++calls===1;
    if(first)assert.match(prompt,/unripe cooking banana/);
    else assert.match(prompt,/"correction":"kaccha papita"/);
    const data=first?{meals:[{name:'Rice and sabzi',location:'plate',box:[0,0,1000,1000],dishes:[rice,original]}]}:corrected;
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(data)}]}}]});
  });
  const {profile}=await (await request('photo',{image:'/9j/',mimeType:'image/jpeg',mode:'meal'})).json();
  const response=await request('correct-dish',{dish:profile.dishes[1],correction:'kaccha papita'});
  assert.equal(response.status,200);
  const next=replacePhotoDish(profile,1,await response.json());
  assert.equal(next.name,'Rice, Green papaya sabzi');
  assert.equal(next.quantity,250);
  assert.equal(next.parts[0],profile.parts[0]);
  assert.equal(next.parts[1].grams,100);
  assert.equal(entryTotals(profile).energy_kcal,315);
  assert.equal(entryTotals(next).energy_kcal,265);
  assert.equal(entryTotals({...next,quantity:125}).carbohydrate_g,25);
  assert.deepEqual(next.dishes[1].ingredients,['green papaya','cumin']);
  assert.equal((await request('correct-dish',{dish:original,correction:' '})).status,400);
});
