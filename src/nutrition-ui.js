(() => {
  const $=id=>document.getElementById(id), keys=['energy_kcal','protein_g','carbohydrate_g','fat_g'],fields=['food-kcal','food-protein','food-carbs','food-fat'];
  const page=$('nutrition-page'),form=$('food-form'),results=$('food-results'),diary=$('food-diary'),status=$('food-status'),error=$('food-error'),date=$('food-date');
  let profile=null,searchRevision=0,dayRevision=0,loaded=false,pendingId=null,saving=false,editing=false;
  let activePhotoGroup=null, correcting=false;
  date.value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const fmt=n=>Number(n).toLocaleString('en-IN',{maximumFractionDigits:1});
  const el=(tag,content,parent)=>{const node=document.createElement(tag);if(content!==undefined)node.textContent=content;if(parent)parent.append(node);return node;};
  const failure=e=>{error.textContent=e.message;status.textContent='';};
  const clear=()=>{status.textContent='';error.textContent='';};
  async function api(path,options={}){let r;try{r=await fetch('/api/nutrition/'+path,{credentials:'same-origin',cache:'no-store',...options,headers:{'content-type':'application/json',...options.headers}});}catch{throw new Error('Connection unavailable. Keep this page open and retry; no save has been confirmed.');}let data;try{data=await r.json();}catch{throw new Error('The service could not complete this request. Please retry.');}if(!r.ok)throw new Error(data.error||'Request failed. Please retry.');return data;}
  function ingredientReview(parent,description,apply,wholeMeal){
    const choices=el('details',undefined,parent);
    choices.className='ingredient-review';
    const lookalike=vegetableLookalike(description);
    choices.open=lookalike;
    el('summary',lookalike?'Check the main ingredient':'Correct the dish',choices);
    if(lookalike){
      el('p','Peeled vegetables can look alike once cooked. Choose the one you used if the estimate needs changing.',choices);
      const buttons=el('div',undefined,choices);buttons.className='vegetable-choices';
      for(const [label,ingredient] of [['Potato (aloo)','potato'],['Raw banana (kaccha kela)','unripe cooking banana'],['Raw papaya (kaccha papita)','green papaya']]){
        const button=el('button',wholeMeal?label:label+' sabzi',buttons);button.type='button';
        button.onclick=()=>apply(wholeMeal?ingredient:ingredient+' sabzi');
      }
    }
    const label=el('label',wholeMeal?'Ingredient or recipe':'Corrected dish name',choices);
    const input=el('input',undefined,label);input.type='text';input.maxLength=120;
    input.placeholder=wholeMeal?'e.g. raw banana with coconut':'e.g. vazhakkai poriyal';
    const run=el('button','Update estimate',choices);run.type='button';
    run.onclick=()=>{const value=input.value.trim();if(value)apply(value);else input.focus();};
    input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();run.click();}};
  }
  async function reviseDish(index,correction){
    if(saving||correcting)return;
    const before=profile, revision=++searchRevision;
    correcting=true;clear();status.textContent='Updating the dish and meal totals…';
    $('food-log').disabled=true;
    try{
      const revised=await postFood('correct-dish',{dish:before.dishes[index],correction});
      if(revision!==searchRevision || profile!==before || form.hidden)return;
      const next=replacePhotoDish(before,index,revised);
      next.source=revised.source+' · corrected meal';
      const portion=$('food-quantity').value;
      const customName=$('food-name').value!==before.name?$('food-name').value:null;
      activePhotoGroup?.update(next);
      openProfile(next,activePhotoGroup);
      if(customName!==null)$('food-name').value=customName;
      $('food-quantity').value=portion;calculate();
      status.textContent='Updated '+next.dishes[index].name+' and the totals for your portion.';
    }catch(e){if(revision===searchRevision&&profile===before)failure(e);}
    finally{correcting=false;$('food-log').disabled=saving||!loaded;}
  }
  function displayDishes(parent,dishes,editable=false){
    const list=el('ul',undefined,parent);list.className='food-dish-list';
    for(const [index,dish] of dishes.entries()){
      const item=el('li',undefined,list);
      el('strong',dish.name,item);
      if(dish.ingredients.length)el('span','Likely ingredients · '+dish.ingredients.join(', '),item);
      el('span','Possible preparation · '+dish.preparation,item);
      if(editable)ingredientReview(item,[dish.name,...dish.ingredients,dish.preparation].join(' '),value=>reviseDish(index,value),true);
    }
  }
  function calculateMeal(){
    const box=$('food-calculation'),q=Number($('food-quantity').value);
    box.replaceChildren();
    if(!(q>0)){box.textContent='Enter the amount eaten to estimate your portion.';return;}
    const [kcal,protein,carbs,fat]=fields.map(id=>fmt(Number($(id).value)*q/100));
    el('strong','Estimated portion total · '+kcal+' kcal',box);
    el('span','Protein '+protein+' g · Carbohydrates '+carbs+' g · Fat '+fat+' g',box);
  }
  function calculate(){if(profile?.dishes){$('food-quantity-unit').textContent='g';calculateMeal();return;}const unit=$('food-unit').value;const n=Number($('food-kcal').value),q=Number($('food-quantity').value);$('food-quantity-unit').textContent=unit;$('food-calculation').textContent=$('food-kcal').value!==''&&q>0?fmt(n*q/100)+' kcal in '+fmt(q)+' '+unit:'Enter package values and your portion.';}
  const geminiEstimate=$('food-gemini-estimate');
  function openProfile(p,group=null){
    activePhotoGroup=group;
    const wholeMeal=Boolean(p?.dishes);
    profile=p;pendingId=null;editing=false;form.hidden=false;
    form.classList.toggle('meal-review',wholeMeal);
    geminiEstimate.hidden=!(p?.source?.startsWith('ML') || p?.source==='Drink guide');geminiEstimate.disabled=false;
    $('food-review-title').textContent=group?'Review meal '+group.number+' · '+group.location:wholeMeal?'Review your meal':'Confirm your food and portion';
    $('food-log').textContent=wholeMeal?'Log meal':'Log this portion';
    $('food-name').value=p?.name||'';
    $('food-source').textContent=(p?.source||'Manual package entry')+(p?.is_estimate?' · approximate':'');
    const review=$('food-dish-review');review.replaceChildren();review.hidden=!wholeMeal;
    if(wholeMeal)displayDishes(review,p.dishes,Boolean(p.parts));
    $('food-preparation').textContent=wholeMeal?
      'Portions, ingredients and cooking oil are estimated. Adjust the grams if you ate a different amount in the same proportions.':
      [p?.preparation,p?.assumptions].filter(Boolean).join('\n');
    $('food-unit').value=p?.unit||'g';
    $('food-basis-hint').hidden=wholeMeal;
    for(const id of ['food-unit',...fields])$(id).closest('label').hidden=wholeMeal;
    fields.forEach((id,i)=>{
      const value=p?.nutrition?.[keys[i]];
      $(id).value=value==null?'':wholeMeal?value:Math.round(value*10)/10;
    });
    $('food-quantity').value=p?.quantity??100;
    calculate();$('food-name').focus({preventScroll:true});
    form.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  }
  const edited=event=>{pendingId=null;if([...fields,'food-name','food-unit'].includes(event.target.id))editing=true;calculate();};
  form.addEventListener('input',edited);form.addEventListener('change',edited);
  $('food-manual').onclick=()=>{searchRevision++;$('food-find').disabled=false;clear();results.hidden=true;openProfile(null);};
  $('food-cancel').onclick=()=>{if(!saving){searchRevision++;form.hidden=true;}};
  async function loadDay(){
    const revision=++dayRevision,day=date.value;loaded=false;$('food-log').disabled=true;diary.replaceChildren(el('p','Loading your diary…'));['food-total-energy','food-total-protein','food-total-carbs','food-total-fat'].forEach(id=>$(id).textContent='—');
    if(!date.reportValidity())return;
    $('food-diary-date').textContent=new Date(day+'T12:00:00Z').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kolkata'});
    try{const data=await api('entries?date='+encodeURIComponent(day));if(revision!==dayRevision)return;loaded=true;$('food-log').disabled=saving;['food-total-energy','food-total-protein','food-total-carbs','food-total-fat'].forEach((id,i)=>$(id).textContent=fmt(data.totals[keys[i]]));diary.replaceChildren();if(!data.entries.length){const p=el('p','No food logged for this day. Add your first meal above.',diary);p.className='food-empty';return;}
      for(const meal of ['Breakfast','Lunch','Dinner','Snack']){const entries=data.entries.filter(e=>e.meal===meal);if(!entries.length)continue;const group=el('div',undefined,diary);group.className='food-meal';el('h3',meal,group);for(const entry of entries){const row=el('div',undefined,group);row.className='food-entry';const name=el('div',undefined,row);el('strong',entry.name,name);if(entry.dishes){const details=el('details',undefined,name);el('summary','Meal breakdown',details);displayDishes(details,entry.dishes);}el('small',fmt(entry.quantity)+' '+entry.unit+' · '+entry.source+(entry.is_estimate?' · approximate':''),name);const end=el('div',undefined,row);end.className='food-entry-end';el('strong',fmt(entry.nutrition.energy_kcal*entry.quantity/100)+' kcal',end);const remove=el('button','Remove',end);remove.type='button';remove.setAttribute('aria-label','Remove '+entry.name+' from '+meal);remove.onclick=async()=>{remove.disabled=true;clear();try{await api('entries?date='+encodeURIComponent(day)+'&id='+encodeURIComponent(entry.id),{method:'DELETE'});await loadDay();status.textContent='Entry removed from your account.';}catch(e){remove.disabled=false;failure(e);}};}}
    }catch(e){if(revision!==dayRevision)return;diary.replaceChildren(el('p','Could not load your diary. Retry to reconnect.'));const retry=el('button','Retry diary',diary);retry.type='button';retry.onclick=()=>{clear();loadDay();};failure(e);}
  }
  date.onchange=()=>{if(saving)return;clear();pendingId=null;loadDay();};
  const postFood=(path,body)=>api(path,{method:'POST',body:JSON.stringify(body)});
  geminiEstimate.onclick=async()=>{
    const name=$('food-name').value.trim();
    if(!name){$('food-name').reportValidity();return;}
    const revision=++searchRevision;
    geminiEstimate.disabled=true;clear();status.textContent='Asking Gemini for a nutrition estimate…';
    const originalUnit=$('food-unit').value;
    const inputs=[...form.querySelectorAll('input,select')];
    const initialValues=inputs.map(input=>input.value);
    try{
      const {profile:next}=await postFood('confirm',{name,provider:'gemini'});
      if(revision!==searchRevision||saving)return;
      if(inputs.some((input,index)=>input.value!==initialValues[index])){
        status.textContent='Your edits were kept. Ask Gemini again to use the current values.';return;
      }
      const quantity=$('food-quantity').value;
      openProfile(next);
      if(originalUnit===next.unit)$('food-quantity').value=quantity;
      calculate();status.textContent='Review the '+next.source+' and portion before logging.';
    }catch(e){if(revision===searchRevision)failure(e);}
    finally{if(!saving)geminiEstimate.disabled=false;}
  };
  function showPhotoMeals(meals,image){
    el('h3','Meals in this photo',results);
    el('p','Review and log each portion you ate.',results);
    const map=el('div',undefined,results);map.className='meal-photo-map';
    const photo=el('img',undefined,map);photo.src='data:image/jpeg;base64,'+image;
    photo.alt='Meal photo with numbered meal locations';
    for(const [index,meal] of meals.entries()){
      const number=index+1,p=meal.profile;
      if(meal.box){
        const [top,left,bottom,right]=meal.box;
        const box=el('span',undefined,map);box.className='meal-photo-box';box.setAttribute('aria-hidden','true');
        Object.assign(box.style,{top:top/10+'%',left:left/10+'%',height:(bottom-top)/10+'%',width:(right-left)/10+'%'});
        el('b',String(number),box);
      }
      const row=el('div',undefined,results);row.className='food-result';
      const info=el('div',undefined,row);
      el('p','Meal '+number+' · '+meal.location,info).className='meal-location';
      const copy=el('div',undefined,info);
      function update(next){
        meal.profile=next;copy.replaceChildren();
        el('strong',next.name,copy);el('span',next.source,copy).className='food-badge';
        const totals=keys.map(k=>fmt(next.nutrition[k]*next.quantity/100));
        el('p','Estimated '+totals[0]+' kcal · Protein '+totals[1]+' g · Carbs '+totals[2]+' g · Fat '+totals[3]+' g',copy);
        const details=el('details',undefined,copy);el('summary','Dishes and likely ingredients',details);displayDishes(details,next.dishes);
      }
      update(p);
      const button=el('button','Review meal '+number,row);button.type='button';
      const group={number,location:meal.location,button,id:crypto.randomUUID(),update};
      button.onclick=()=>{if(saving)return;clear();openProfile(meal.profile,group);};
    }
    results.scrollIntoView({block:'start'});
  }
  function showMatches(data,path,body,requestedGemini=false){
    results.replaceChildren();results.hidden=false;status.textContent='';
    if(data.warnings?.length)error.textContent=data.warnings.join('\n');
    if(data.meals){showPhotoMeals(data.meals,body.image);return;}
    if(data.profile){openProfile(data.profile);return;}
    if(path==='photo'){
      const description=(data.candidates||[]).map(c=>c.name+' '+c.reason).join(' ');
      ingredientReview(results,description,async name=>{
        if(saving)return;
        const revision=++searchRevision;clear();form.hidden=true;status.textContent='Estimating the dish you identified…';
        try{
          const {profile:next}=await postFood('confirm',{name});
          if(revision!==searchRevision)return;
          openProfile(next);status.textContent='Review the corrected dish and portion before logging.';
        }catch(e){if(revision===searchRevision)failure(e);}
      },false);
    }
    if(!data.candidates?.length){
      el('p',data.message||'No food recognized. Try a specific name or enter the package values manually.',results);
      if(data.name){const button=el('button','Enter nutrition for '+data.name,results);button.type='button';button.onclick=()=>openProfile({name:data.name,source:'Manual package entry'});}
      return;
    }
    function busy(value){results.querySelectorAll('button').forEach(button=>button.disabled=value);}
    for(const candidate of data.candidates){
      const row=el('div',undefined,results);row.className='food-result';
      const copy=el('div',undefined,row);el('strong',candidate.name,copy);
      const tag=el('span',candidate.source||'Gemini',copy);tag.className='food-badge';
      tag.title=candidate.source==='ML'?Math.round(candidate.confidence*100)+'% '+candidate.score_kind:'Identified by '+candidate.source;
      tag.setAttribute('aria-label',tag.textContent+' · '+tag.title);el('p',candidate.reason,copy);
      const confirm=el('button','Review portion',row);confirm.type='button';
      confirm.onclick=async()=>{
        if(saving)return;
        const revision=++searchRevision;busy(true);clear();status.textContent='Estimating the confirmed food…';
        try{
          const result=await postFood('confirm',{name:candidate.name,...(requestedGemini?{provider:'gemini'}:{})});
          if(revision!==searchRevision)return;
          openProfile(result.profile);
          status.textContent='Review the nutrition, preparation and portion before logging.';
        }catch(e){if(revision===searchRevision)failure(e);}
        finally{busy(false);}
      };
    }
    if(data.candidates.some(candidate=>candidate.source==='ML'||candidate.source==='Drink guide')){
      const ask=el('button',path==='photo'?'Ask Gemini about this photo':'Ask Gemini for other matches',results);
      ask.type='button';
      ask.onclick=async()=>{
        if(saving)return;
        const revision=++searchRevision;busy(true);clear();status.textContent='Asking Gemini for food matches…';
        try{
          const alternative=await postFood(path,{...body,provider:'gemini'});
          if(revision!==searchRevision)return;
          if(alternative.candidates?.length){form.hidden=true;showMatches(alternative,path,null,true);}
          else status.textContent=(alternative.source||'Gemini')+' found no matches. You can still use the ML result.';
        }catch(e){if(revision===searchRevision)failure(e);}
        finally{busy(false);}
      };
    }
  }
  let photoWorker=null,mlRequest=null,mlSequence=0;
  function stopPhotoModel(){
    photoWorker?.terminate();photoWorker=null;
    if(mlRequest){clearTimeout(mlRequest.timer);mlRequest.resolve({candidates:[],fallback_reason:'Local recognition was interrupted.'});mlRequest=null;}
  }
  function browserPhoto(body,onProgress){
    if(mlRequest)stopPhotoModel();
    return new Promise(resolve=>{
      const id=++mlSequence;
      try{
        photoWorker ||= new Worker('/food-ml-worker.js',{type:'module'});
        const timer=setTimeout(()=>stopPhotoModel(),240000);
        mlRequest={id,resolve,timer,onProgress};
        photoWorker.onmessage=({data})=>{
          if(data.type==='progress'){mlRequest?.onProgress(data.message);return;}
          if(data.type!=='result'||data.id!==mlRequest?.id)return;
          const pending=mlRequest;mlRequest=null;clearTimeout(pending.timer);pending.resolve(data.data);
        };
        photoWorker.onerror=()=>stopPhotoModel();
        photoWorker.postMessage({id,...body});
      }catch{stopPhotoModel();resolve({candidates:[],fallback_reason:'Local recognition is unavailable in this browser.'});}
    });
  }
  async function findFood(path,body){
    const revision=++searchRevision;clear();form.hidden=true;results.replaceChildren();results.hidden=true;status.textContent=path==='search'&&/^\d+$/.test(body.query)?'Looking up barcode '+body.query+'…':'Finding your food…';$('food-find').disabled=true;
    try{
      let data;
      if(path==='photo'&&body.mode==='meal'){
        status.textContent='Finding the meals and estimating each portion…';
        data=await postFood(path,body);
      }else if(path==='photo'){
        data=await browserPhoto(body,message=>{if(revision===searchRevision)status.textContent=message;});
        if(revision!==searchRevision)return;
        if(!data.candidates?.length){status.textContent='Local model could not recognize this reliably. Trying Gemini…';data=await api(path,{method:'POST',body:JSON.stringify(body)});data.warnings=[...(data.warnings||[]),'Local recognition did not identify this food reliably.'];}
      }else data=await api(path,{method:'POST',body:JSON.stringify(body)});
      if(revision!==searchRevision)return;showMatches(data,path,body);
    }
    catch(e){if(revision===searchRevision)failure(e);}finally{if(revision===searchRevision)$('food-find').disabled=false;}
  }
  $('food-search').onsubmit=event=>{event.preventDefault();if($('food-search').reportValidity())findFood('search',{query:$('food-query').value.trim()});};
  $('drink-choice').onchange=()=>{
    const choice=$('drink-choice');
    if (!choice.value || saving) return;
    $('food-query').value=choice.value;
    choice.value='';
    renderFoods();
    $('food-search').requestSubmit();
  };
  let savedFoods=[],foodsLoaded=false,foodsLoading=false;
  function renderFoods(){
    const list=$('food-frequent');list.replaceChildren();const query=$('food-query').value.trim().toLocaleLowerCase();const foods=savedFoods.filter(f=>!query||f.name.toLocaleLowerCase().includes(query)).slice(0,8);
    if(!foods.length){el('p',savedFoods.length?'No saved foods match this search. Clear the box to see your usual foods.':'Foods you log will appear here automatically.',list).className='food-muted';return;}
    const grid=el('div',undefined,list);grid.className='food-frequent-grid';
    for(const f of foods){const row=el('div',undefined,grid);row.className='food-frequent-item';const copy=el('div',undefined,row);el('strong',f.name,copy);el('small',fmt(f.quantity)+' '+f.unit+' · '+fmt(f.nutrition.energy_kcal*f.quantity/100)+' kcal'+(f.is_estimate?' · approximate':''),copy);const button=el('button','Use again',row);button.type='button';button.setAttribute('aria-label','Use '+f.name+' again');button.onclick=()=>{if(saving)return;searchRevision++;$('food-find').disabled=false;clear();results.hidden=true;openProfile({...f,assumptions:'Previously logged values. Check the preparation and portion for this meal.'});$('food-quantity').value=f.quantity;$('food-meal').value=f.meal;calculate();};}
  }
  async function loadFoods(force=false){if(foodsLoading||foodsLoaded&&!force)return;foodsLoading=true;try{const data=await api('foods');savedFoods=data.foods;foodsLoaded=true;renderFoods();}catch{if(!foodsLoaded){const list=$('food-frequent');list.replaceChildren(el('p','Saved foods could not be loaded.'));const retry=el('button','Retry saved foods',list);retry.type='button';retry.onclick=()=>loadFoods();}}finally{foodsLoading=false;}}
  $('food-query').addEventListener('input',()=>{if(foodsLoaded)renderFoods();});
  form.onsubmit=async event=>{
    event.preventDefault();if(saving||correcting||!loaded||!form.reportValidity())return;clear();pendingId ||= activePhotoGroup?.id || crypto.randomUUID();const entry={id:pendingId,date:date.value,meal:$('food-meal').value,name:$('food-name').value.trim(),unit:$('food-unit').value,quantity:Number($('food-quantity').value),nutrition:Object.fromEntries(keys.map((k,i)=>[k,Number($(fields[i]).value)])),source:profile?(editing?'Manual adjustment · '+profile.source:profile.source):'Manual package entry',is_estimate:profile?.is_estimate===true,...(profile?.dishes?{dishes:profile.dishes}:{})};
    searchRevision++;saving=true;$('food-camera').disabled=true;date.disabled=true;$('food-manual').disabled=true;$('food-find').disabled=true;form.querySelectorAll('input,select,button').forEach(n=>n.disabled=true);status.textContent='Saving this portion…';
    try{
      await api('entries',{method:'POST',body:JSON.stringify(entry)});
      const group=activePhotoGroup;
      loadFoods(true);pendingId=null;activePhotoGroup=null;form.hidden=true;
      if(group){
        group.button.disabled=true;group.button.textContent='Logged';
        group.button.setAttribute('aria-label','Meal '+group.number+' logged');
        results.scrollIntoView({block:'start'});
      }else{results.replaceChildren();results.hidden=true;}
      await loadDay();
      status.textContent=loaded?(group?'Meal '+group.number+' logged.':'Portion saved to your account.'):'Portion saved. Retry the diary to refresh your daily totals.';
    }catch(e){failure(e);}finally{saving=false;$('food-camera').disabled=false;date.disabled=false;$('food-manual').disabled=false;$('food-find').disabled=false;form.querySelectorAll('input,select,button').forEach(n=>n.disabled=false);$('food-log').disabled=!loaded;}
  };
  window.addEventListener('nutrition-open',()=>{if(page.hidden)return;clear();loadDay();loadFoods();});
  if(location.pathname.replace(/\/$/,'')==='/nutrition'){loadDay();loadFoods();}
  const cameraDialog=$('food-camera-dialog'),cameraStatus=$('food-camera-status'),video=$('food-camera-video');
  let scanTimer=null,cameraRevision=0,photoData=null,photoURL=null,readerLoading=null,nativeLoading=null;
  const productCode=value=>typeof value==='string'&&/^(?:\d{8}|\d{12,14})$/.test(value);
  const scanActive=revision=>revision===cameraRevision&&cameraDialog.open;
  function reader(){
    readerLoading ||= (async()=>{
      if(!window.ZXingBrowser)await new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src='/barcode-reader.js';
        script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error('Barcode reader could not load.'));};
        document.head.append(script);
      });
      const {BarcodeFormat,BrowserMultiFormatOneDReader}=window.ZXingBrowser;
      // ZXing's browser bundle exports BarcodeFormat but omits DecodeHintType.
      const possibleFormats=2;
      const formats=['EAN_13','EAN_8','UPC_A','UPC_E','ITF','CODE_128','CODE_39'].map(name=>BarcodeFormat[name]);
      return new BrowserMultiFormatOneDReader(new Map([[possibleFormats,formats]]));
    })().catch(e=>{readerLoading=null;throw e;});
    return readerLoading;
  }
  function nativeReader(){
    nativeLoading ||= (async()=>{
      if(!window.BarcodeDetector)return null;
      const supported=await window.BarcodeDetector.getSupportedFormats();
      const formats=['ean_13','ean_8','upc_a','upc_e','itf','code_128','code_39'].filter(f=>supported.includes(f));
      return formats.length?new window.BarcodeDetector({formats}):null;
    })().catch(()=>null);
    return nativeLoading;
  }
  async function nativeCode(detector,source){
    if(detector){
      try{return (await detector.detect(source)).find(hit=>productCode(hit.rawValue))?.rawValue;}catch{}
    }
  }
  function decodeFrame(decoder,canvas,source,width,height,band=false,rotate=false){
    const h=band?Math.max(1,Math.round(height*0.48)):height;
    const y=Math.floor((height-h)/2);
    const wOut=rotate?h:width,hOut=rotate?width:h;
    if(canvas.width!==wOut||canvas.height!==hOut){canvas.width=wOut;canvas.height=hOut;}
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.save();
    try{
      if(rotate){ctx.translate(h,0);ctx.rotate(Math.PI/2);}
      ctx.drawImage(source,0,y,width,h,0,0,width,h);
    }finally{ctx.restore();}
    try{return decoder.decodeFromCanvas(canvas).getText();}catch{return null;}
  }
  function stopCamera(){
    cameraRevision++;clearTimeout(scanTimer);scanTimer=null;
    const stream=video.srcObject;stream?.getTracks().forEach(track=>track.stop());video.srcObject=null;
    $('food-scanner-view').hidden=true;$('food-scan-stop').hidden=true;$('food-scan-start').disabled=false;
  }
  function clearPhoto(){photoData=null;if(photoURL)URL.revokeObjectURL(photoURL);photoURL=null;$('food-photo-preview').removeAttribute('src');$('food-photo-preview').hidden=true;$('food-photo-identify').hidden=true;$('food-photo-meal').hidden=true;$('food-photo-notice').hidden=true;}
  function acceptBarcode(code){
    if(!productCode(code))return false;
    stopCamera();cameraDialog.close();$('food-query').value=code;renderFoods();$('food-search').requestSubmit();return true;
  }
  $('food-camera').onclick=()=>{if(saving)return;stopCamera();clearPhoto();cameraStatus.textContent='Scan a package barcode, or choose a picture of a barcode or food.';cameraDialog.showModal();};
  $('food-camera-close').onclick=()=>cameraDialog.close();
  cameraDialog.addEventListener('close',()=>{stopCamera();clearPhoto();$('food-picture-input').value='';$('food-camera-input').value='';});
  $('food-scan-stop').onclick=()=>{stopCamera();cameraStatus.textContent='Camera stopped. Choose another option above.';};
  $('food-scan-start').onclick=async()=>{
    stopCamera();clearPhoto();const revision=cameraRevision;cameraStatus.textContent='Allow camera access to scan a product barcode.';
    if(!navigator.mediaDevices?.getUserMedia){cameraStatus.textContent='Live camera is unavailable in this browser. Choose a barcode picture or type the digits instead.';return;}
    $('food-scan-start').disabled=true;
    const decoderReady=reader().catch(()=>null),nativeReady=nativeReader();
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{
        facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}
      }});
      if(!scanActive(revision)){stream.getTracks().forEach(t=>t.stop());return;}
      video.srcObject=stream;$('food-scanner-view').hidden=false;$('food-scan-stop').hidden=false;
      const track=stream.getVideoTracks()[0];
      if(track?.getCapabilities?.().focusMode?.includes('continuous')){
        track.applyConstraints({advanced:[{focusMode:'continuous'}]}).catch(()=>{});
      }
      await video.play();
      if(!scanActive(revision))return;
      cameraStatus.textContent='Fit the whole barcode in the frame, including the space at both ends.';
      let decoder=null,detector=null,attempt=0;
      decoderReady.then(value=>{decoder=value;});nativeReady.then(value=>{detector=value;});
      Promise.all([decoderReady,nativeReady]).then(([fallback,native])=>{
        if(scanActive(revision)&&!fallback&&!native){stopCamera();cameraStatus.textContent='The barcode reader could not load. Try again or enter the digits.';}
      });
      const canvas=document.createElement('canvas');
      async function scan(){
        if(!scanActive(revision))return;
        if(video.readyState>=2&&video.videoWidth){
          const code=await nativeCode(detector,video);
          if(!scanActive(revision)||acceptBarcode(code))return;
          // Use the guide area for speed, then periodically check the full frame and vertical labels.
          if(decoder&&(!detector||attempt%3===0)){
            const pass=detector?attempt/3:attempt;
            const fallback=decodeFrame(decoder,canvas,video,video.videoWidth,video.videoHeight,pass%4<2,pass%4===3);
            if(acceptBarcode(fallback))return;
          }
          attempt++;
        }
        scanTimer=setTimeout(scan,110);
      }
      await scan();
    }catch(e){if(scanActive(revision)){stopCamera();cameraStatus.textContent=e.name==='NotAllowedError'?'Camera access was not allowed. Choose a picture or enable camera access in your browser.':e.name==='NotFoundError'?'No camera was found. Choose a picture instead.':'Could not start the scanner. Choose a clear barcode picture or type the digits instead.';}}
  };
  $('food-photo-take').onclick=()=>{$('food-camera-input').click();};
  $('food-picture-pick').onclick=()=>{$('food-picture-input').click();};
  async function choosePicture(event){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    stopCamera();clearPhoto();const revision=cameraRevision;
    if(file.size>12*1024*1024){cameraStatus.textContent='Choose a picture smaller than 12 MB.';return;}
    if(!file.type.startsWith('image/')){cameraStatus.textContent='Choose an image file.';return;}
    cameraStatus.textContent='Checking the picture for a barcode…';
    try{
      const image=new Image();photoURL=URL.createObjectURL(file);image.src=photoURL;await image.decode();if(revision!==cameraRevision)return;
      const native=await nativeReader();
      if(!scanActive(revision))return;
      const nativeValue=await nativeCode(native,image);
      if(!scanActive(revision)||acceptBarcode(nativeValue))return;
      const canvas=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
      canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      const decoder=await reader().catch(()=>null);
      if(!scanActive(revision))return;
      if(decoder){
        const frame=document.createElement('canvas');
        for(const rotate of [false,true]){
          if(acceptBarcode(decodeFrame(decoder,frame,canvas,canvas.width,canvas.height,false,rotate)))return;
        }
      }
      photoData=canvas.toDataURL('image/jpeg',0.85).split(',')[1];$('food-photo-preview').src=photoURL;$('food-photo-preview').hidden=false;
      cameraStatus.textContent='Choose whether to analyze the meals in this photo or identify one food or drink.';$('food-photo-identify').hidden=false;$('food-photo-meal').hidden=false;$('food-photo-notice').hidden=false;
    }catch{if(revision===cameraRevision){clearPhoto();cameraStatus.textContent='This picture could not be opened. Try a JPEG, PNG or WebP image.';}}
  }
  $('food-picture-input').onchange=choosePicture;$('food-camera-input').onchange=choosePicture;
  $('food-photo-meal').onclick=()=>{if(!photoData)return;const image=photoData;cameraDialog.close();findFood('photo',{image,mimeType:'image/jpeg',mode:'meal'});};
  $('food-photo-identify').onclick=()=>{if(!photoData)return;const image=photoData;cameraDialog.close();findFood('photo',{image,mimeType:'image/jpeg'});};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopCamera();if(cameraDialog.open)cameraStatus.textContent='Camera paused. Tap Scan barcode to resume.';}});
  new MutationObserver(()=>{if(page.hidden){if(cameraDialog.open)cameraDialog.close();searchRevision++;stopPhotoModel();}}).observe(page,{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('pagehide',()=>{stopCamera();stopPhotoModel();});

})();
