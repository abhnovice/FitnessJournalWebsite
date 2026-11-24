(() => {
  const get=id=>document.getElementById(id);
  const day=get('food-date'), list=get('baseline-meals'), notes=get('baseline-adjustments');
  const generate=get('baseline-generate'), result=get('baseline-result'), status=get('baseline-status');
  let revision=0, ready=false;
  function add(parent,tag,text){
    const n=document.createElement(tag);n.textContent=text;parent.append(n);return n;
  }
  function clear(){
    revision++;ready=false;generate.disabled=true;result.hidden=true;
    list.replaceChildren();notes.replaceChildren();get('legacy-photos').replaceChildren();
    get('baseline-count').textContent='';status.textContent='';
  }
  window.addEventListener('diary-loading',clear);
  async function olderPhotos(date,entries,version){
    const holder=get('legacy-photos');
    try{
      const r=await fetch('/api/nutrition/adherence?date='+date,{cache:'no-store'});
      if(!r.ok||version!==revision)return;
      const previous=await r.json();if(version!==revision)return;
      const pending=baselineMeals.filter(m=>previous.photos[m.id]&&!entries.some(e=>e.legacySlot===m.id));
      if(!pending.length)return;
      add(holder,'p','Earlier checklist photos · review and log these to include them in this diary.');
      for(const m of pending){
        const button=add(holder,'button','Review '+m.label.toLowerCase()+' photo');
        button.type='button';button.onclick=()=>window.dispatchEvent(new CustomEvent('review-legacy-photo',{detail:{date,slot:m.id}}));
      }
    }catch{/* The diary and its current photos are independent of the previous checklist. */}
  }
  window.addEventListener('diary-updated',({detail:data})=>{
    if(data.date!==day.value)return;
    clear();ready=true;generate.disabled=false;
    const {checklist:c}=data;
    const photographed=data.entries.filter(e=>e.evidence).length;
    get('baseline-count').textContent=photographed+' photo-backed '+(photographed===1?'entry':'entries')+' · '+c.coverage+'% of planned foods covered';
    for(const meal of baselineMeals){
      const card=add(list,'article','');add(card,'h3',meal.label);
      for(const id of Object.keys(meal.foods)){
        const amt=c.portions[id],line=add(card,'div','');line.className='baseline-check';
        add(line,'b',amt>=1?'✓':amt>0?'◐':'○');
        const note=amt===0?(data.finalized?'missing photo evidence':'awaiting photo'):amt===1?'complete':Math.round(100*amt)+'% of target'+(amt>1?' · over target':' · short');
        add(line,'span',portionTargets[id]+' · '+note);
      }
    }
    if(c.extras.length)add(notes,'p','Additional food and drink · '+c.extras.map(x=>x.name+' ('+x.servings+' serving'+(x.servings===1?'':'s')+')').join(', '));
    if(c.unverified.length)add(notes,'p','Logged without photo credit · '+c.unverified.join(', '));
    const over=Object.keys(c.portions).filter(k=>c.portions[k]>1);
    if(over.length)add(notes,'p','Above plan · '+over.map(k=>portionTargets[k]+' (+'+Math.round((c.portions[k]-1)*100)+'%)').join(', '));
    result.hidden=!data.finalized;
    get('baseline-number').textContent=data.finalized?c.score+'%':'';
    generate.hidden=data.finalized;
    olderPhotos(data.date,data.entries,revision);
  });
  generate.onclick=async()=>{
    if(!ready)return;
    const version=revision;generate.disabled=true;status.textContent='Saving score…';
    try{
      const r=await fetch('/api/nutrition/diary-score?date='+day.value,{method:'POST'});
      const data=await r.json();if(version!==revision)return;
      if(!r.ok)throw Error(data.error||'Could not save the score. Try again.');
      window.dispatchEvent(new CustomEvent('diary-updated',{detail:data}));
      status.textContent='Score saved for this diary date.';
    }catch(e){if(version===revision){status.textContent=e.message;generate.disabled=false;}}
  };
})();
