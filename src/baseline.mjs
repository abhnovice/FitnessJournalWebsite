export const baselineMeals = [
  {id:'breakfast', label:'Breakfast', plan:'1 whole avocado · 4 boiled eggs', foods:{avocado:'1 avocado', eggs:'4 boiled eggs'}},
  {id:'midday', label:'Mid-day snack', plan:'3 medium bananas', foods:{bananas:'3 bananas'}},
  {id:'lunch', label:'Lunch', plan:'200 g raw chicken breast · 25 g chicken liver · 30 g boiled baby spinach · up to 10 g mustard oil · up to 5 g ghee', foods:{chicken:'Chicken breast', liver:'Chicken liver', spinach:'Spinach'}},
  {id:'evening', label:'Mid-evening snack', plan:'2 medium Nagpur oranges · 25 g shelled sunflower seeds', foods:{oranges:'2 oranges', seeds:'Sunflower seeds'}},
  {id:'paneer', label:'Between lunch and dinner', plan:'200 g drained high-protein paneer · lemon · iodized salt', foods:{paneer:'Paneer'}},
  {id:'dinner', label:'Dinner', plan:'250 ml toned milk · omega-3 supplying 750–1,000 mg EPA + DHA · 3–5 g creatine monohydrate', foods:{milk:'Milk'}}
];

// Quantities are expressed in portions of the complete daily target.
export const portionTargets = {
  avocado:'1 avocado', eggs:'4 boiled eggs', bananas:'3 medium bananas',
  chicken:'200 g raw chicken breast (about 150 g cooked)', liver:'25 g chicken liver',
  spinach:'30 g cooked spinach', oranges:'2 medium oranges', seeds:'25 g shelled sunflower seeds',
  paneer:'200 g drained paneer', milk:'250 ml milk'
};
export function isNamedPlanFood(name) {
  return /^(?:(?:fresh|whole|medium|small|large|boiled|cooked|raw|baby|toned|drained|high.protein|shelled|nagpur|grilled|steamed|plain)\s+)*(?:avocados?|eggs?|bananas?|chicken breast|chicken liver|spinach|palak|oranges?|sunflower seeds?|paneer|milk|lemon|iodi[sz]ed salt|mustard oil|ghee|creatine(?: monohydrate)?|omega.?3)$/i.test(String(name).trim());
}
export function diaryChecklist(entries) {
  const portions = Object.fromEntries(Object.keys(portionTargets).map(key=>[key,0]));
  const extras = [], unverified = [];
  for(const entry of entries) {
    if(!entry.evidence) {
      if(entry.planRole==='planned' || (!entry.planRole && isNamedPlanFood(entry.name))) unverified.push(entry.name);
      else extras.push({name:entry.name,servings:1});
      continue;
    }
    for(const match of entry.evidence.matches) portions[match.food]+=match.servings;
    extras.push(...entry.evidence.extras);
  }
  const rows=baselineMeals.map(meal=>{
    const amounts=Object.keys(meal.foods).map(key=>portions[key]);
    return {id:meal.id,coverage:amounts.reduce((n,x)=>n+Math.min(x,1),0)/amounts.length};
  });
  const surplus=Object.values(portions).reduce((n,x)=>n+Math.max(0,x-1),0);
  const additional=extras.reduce((n,x)=>n+x.servings,0);
  const coverage=rows.reduce((n,r)=>n+r.coverage,0)/rows.length;
  const score=Math.round(100*coverage/(1+(additional+surplus)/Object.keys(portions).length));
  return {portions,rows,extras,unverified,score,coverage:Math.round(100*coverage)};
}
