import catalog from './food-catalog.json' with {type:'json'};
import {drinkGroups} from './drinks.mjs';
export const normalizeFood=value=>String(value).toLowerCase().replace(/&/g,' and ').match(/[a-z0-9]+/g)?.join(' ')||'';
const drinksByName = new Map();
for (const group of Object.values(drinkGroups)) {
  for (const drink of group) {
    for (const name of [drink.name, ...drink.aliases]) drinksByName.set(normalizeFood(name), drink);
  }
}
function drinkProfile(drink) {
  const per100 = amount => amount * 100 / drink.ml;
  return {name:drink.name, unit:'ml', quantity:drink.ml, source:'Drink guide', is_estimate:true,
    nutrition:{energy_kcal:per100(drink.kcal), protein_g:per100(drink.protein),
      carbohydrate_g:per100(drink.carbs), fat_g:per100(drink.fat)},
    preparation:drink.note, assumptions:'Generic estimate. Adjust the pour to the volume you drank.'};
}
function similarity(a,b){
  function blocks(alo,ahi,blo,bhi){
    let best=0,ai=alo,bi=blo,previous=new Map();
    for(let i=alo;i<ahi;i++){
      const next=new Map();
      for(let j=blo;j<bhi;j++)if(a[i]===b[j]){const count=(previous.get(j-1)||0)+1;next.set(j,count);if(count>best){best=count;ai=i-count+1;bi=j-count+1;}}
      previous=next;
    }
    if(!best)return 0;
    return best+blocks(alo,ai,blo,bi)+blocks(ai+best,ahi,bi+best,bhi);
  }
  return a.length+b.length?2*blocks(0,a.length,0,b.length)/(a.length+b.length):1;
}
export function lookupFoods(query){
  const q=normalizeFood(query);if(!q)return [];
  const drink = drinksByName.get(q);
  if (drink) return [{name:drink.name, source:'Drink guide', reason:drink.note}];
  const counts=new Map();
  for(const word of q.split(' ')){
    const padded=' '+word+' ';
    for(let n=2;n<=4;n++){
      let offset=0;
      do{const gram=padded.slice(offset,offset+n),index=catalog.vocabulary[gram];if(index!==undefined)counts.set(index,(counts.get(index)||0)+1);if(offset+n>=padded.length)break;offset++;}while(true);
      if(offset===0)break;
    }
  }
  const vector=new Map();let norm=0;
  for(const [i,count] of counts){const value=count*catalog.idf[i];vector.set(i,value);norm+=value*value;}
  norm=Math.sqrt(norm);if(!norm)return [];
  for(const [i,value] of vector)vector.set(i,value/norm);
  return catalog.foods.map(food=>{
    let score=0;for(let i=0;i<food.indices.length;i++)score+=food.values[i]*(vector.get(food.indices[i])||0);
    return {food,score};
  }).sort((a,b)=>b.score-a.score).slice(0,5).filter(({food,score})=>score>.6&&q.split(' ').some(a=>food.normalized.split(' ').some(b=>similarity(a,b)>=.6))).map(({food,score})=>({name:food.name,nutrition:food.nutrition,confidence:score,source:'ML',score_kind:'name similarity',reason:'Workbook name match. Confirm the preparation before logging.'}));
}
export function lookupNutrition(name){
  const normalized=normalizeFood(name);
  const drink = drinksByName.get(normalized);
  if (drink) return drinkProfile(drink);
  const match=lookupFoods(name).find(f=>normalizeFood(f.name)===normalized);
  if(!match)return null;
  return {name:match.name,unit:'g',nutrition:match.nutrition,source:'ML · Anuvaad INDB 2024.11',is_estimate:false,preparation:'',assumptions:'Per 100 g workbook record; verify the preparation and serving basis.'};
}
