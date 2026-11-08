(() => {
  const $=id=>document.getElementById(id), keys=['energy_kcal','protein_g','carbohydrate_g','fat_g'],fields=['food-kcal','food-protein','food-carbs','food-fat'];
  const page=$('nutrition-page'),form=$('food-form'),results=$('food-results'),diary=$('food-diary'),status=$('food-status'),error=$('food-error'),date=$('food-date');
  let profile=null,searchRevision=0,dayRevision=0,loaded=false,pendingId=null,saving=false,editing=false;
  date.value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const fmt=n=>Number(n).toLocaleString('en-IN',{maximumFractionDigits:1});
  const el=(tag,content,parent)=>{const node=document.createElement(tag);if(content!==undefined)node.textContent=content;if(parent)parent.append(node);return node;};
  const failure=e=>{error.textContent=e.message;status.textContent='';};
  const clear=()=>{status.textContent='';error.textContent='';};
  async function api(path,options={}){let r;try{r=await fetch('/api/nutrition/'+path,{credentials:'same-origin',cache:'no-store',...options,headers:{'content-type':'application/json',...options.headers}});}catch{throw new Error('Connection unavailable. Keep this page open and retry; no save has been confirmed.');}let data;try{data=await r.json();}catch{throw new Error('The service could not complete this request. Please retry.');}if(!r.ok)throw new Error(data.error||'Request failed. Please retry.');return data;}
  function calculate(){const unit=$('food-unit').value;const n=Number($('food-kcal').value),q=Number($('food-quantity').value);$('food-quantity-unit').textContent=unit;$('food-calculation').textContent=$('food-kcal').value!==''&&q>0?fmt(n*q/100)+' kcal in '+fmt(q)+' '+unit:'Enter package values and your portion.';}
  function openProfile(p){profile=p;pendingId=null;editing=false;form.hidden=false;$('food-name').value=p?.name||'';$('food-source').textContent=p?.is_estimate?'Approximate · Gemini estimate':p?.source||'Manual package entry';$('food-preparation').textContent=[p?.preparation,p?.assumptions].filter(Boolean).join('\n');$('food-unit').value=p?.unit||'g';fields.forEach((id,i)=>$(id).value=p?.nutrition?.[keys[i]]??'');$('food-quantity').value=100;calculate();$('food-name').focus({preventScroll:true});form.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
  const edited=event=>{pendingId=null;if([...fields,'food-name','food-unit'].includes(event.target.id))editing=true;calculate();};
  form.addEventListener('input',edited);form.addEventListener('change',edited);
  $('food-manual').onclick=()=>{searchRevision++;$('food-find').disabled=false;clear();results.hidden=true;openProfile(null);};
  $('food-cancel').onclick=()=>{if(!saving)form.hidden=true;};
  async function loadDay(){
    const revision=++dayRevision,day=date.value;loaded=false;$('food-log').disabled=true;diary.replaceChildren(el('p','Loading your diary…'));['food-total-energy','food-total-protein','food-total-carbs','food-total-fat'].forEach(id=>$(id).textContent='—');
    if(!date.reportValidity())return;
    $('food-diary-date').textContent=new Date(day+'T12:00:00Z').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kolkata'});
    try{const data=await api('entries?date='+encodeURIComponent(day));if(revision!==dayRevision)return;loaded=true;$('food-log').disabled=saving;['food-total-energy','food-total-protein','food-total-carbs','food-total-fat'].forEach((id,i)=>$(id).textContent=fmt(data.totals[keys[i]]));diary.replaceChildren();if(!data.entries.length){const p=el('p','No food logged for this day. Add your first meal above.',diary);p.className='food-empty';return;}
      for(const meal of ['Breakfast','Lunch','Dinner','Snack']){const entries=data.entries.filter(e=>e.meal===meal);if(!entries.length)continue;const group=el('div',undefined,diary);group.className='food-meal';el('h3',meal,group);for(const entry of entries){const row=el('div',undefined,group);row.className='food-entry';const name=el('div',undefined,row);el('strong',entry.name,name);el('small',fmt(entry.quantity)+' '+entry.unit+' · '+entry.source+(entry.is_estimate?' · approximate':''),name);const end=el('div',undefined,row);end.className='food-entry-end';el('strong',fmt(entry.nutrition.energy_kcal*entry.quantity/100)+' kcal',end);const remove=el('button','Remove',end);remove.type='button';remove.setAttribute('aria-label','Remove '+entry.name+' from '+meal);remove.onclick=async()=>{remove.disabled=true;clear();try{await api('entries?date='+encodeURIComponent(day)+'&id='+encodeURIComponent(entry.id),{method:'DELETE'});await loadDay();status.textContent='Entry removed from your account.';}catch(e){remove.disabled=false;failure(e);}};}}
    }catch(e){if(revision!==dayRevision)return;diary.replaceChildren(el('p','Could not load your diary. Retry to reconnect.'));const retry=el('button','Retry diary',diary);retry.type='button';retry.onclick=()=>{clear();loadDay();};failure(e);}
  }
  date.onchange=()=>{if(saving)return;clear();pendingId=null;loadDay();};
  function showMatches(data){
    results.hidden=false;status.textContent='';
      if(data.warnings?.length)error.textContent=data.warnings.join('\n');
      if(data.profile){openProfile(data.profile);return;}
      if(data.candidates?.length){for(const candidate of data.candidates){const row=el('div',undefined,results);row.className='food-result';const copy=el('div',undefined,row);el('strong',candidate.name,copy);el('p',candidate.reason,copy);const confirm=el('button','Confirm food & estimate',row);confirm.type='button';confirm.onclick=async()=>{const selected=++searchRevision;results.querySelectorAll('button').forEach(b=>b.disabled=true);clear();status.textContent='Estimating the confirmed food…';try{const result=await api('confirm',{method:'POST',body:JSON.stringify({name:candidate.name})});if(selected!==searchRevision)return;status.textContent='Review the estimate, preparation and portion before logging.';openProfile(result.profile);}catch(e){if(selected===searchRevision)failure(e);}finally{if(selected===searchRevision)results.querySelectorAll('button').forEach(b=>b.disabled=false);}};}}
      else{el('p',data.message||'No food recognized. Try a specific name or enter the package values manually.',results);if(data.name){const button=el('button','Enter nutrition for '+data.name,results);button.type='button';button.onclick=()=>openProfile({name:data.name,source:'Manual package entry'});}}
  }
  async function findFood(path,body){
    const revision=++searchRevision;clear();form.hidden=true;results.replaceChildren();results.hidden=true;status.textContent='Finding your food…';$('food-find').disabled=true;
    try{const data=await api(path,{method:'POST',body:JSON.stringify(body)});if(revision!==searchRevision)return;showMatches(data);}
    catch(e){if(revision===searchRevision)failure(e);}finally{if(revision===searchRevision)$('food-find').disabled=false;}
  }
  $('food-search').onsubmit=event=>{event.preventDefault();if($('food-search').reportValidity())findFood('search',{query:$('food-query').value.trim()});};
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
    event.preventDefault();if(saving||!loaded||!form.reportValidity())return;clear();pendingId ||= crypto.randomUUID();const entry={id:pendingId,date:date.value,meal:$('food-meal').value,name:$('food-name').value.trim(),unit:$('food-unit').value,quantity:Number($('food-quantity').value),nutrition:Object.fromEntries(keys.map((k,i)=>[k,Number($(fields[i]).value)])),source:profile?(editing?'Manual adjustment · '+profile.source:profile.source):'Manual package entry',is_estimate:profile?.is_estimate===true};
    saving=true;$('food-camera').disabled=true;date.disabled=true;$('food-manual').disabled=true;$('food-find').disabled=true;form.querySelectorAll('input,select,button').forEach(n=>n.disabled=true);status.textContent='Saving this portion…';
    try{await api('entries',{method:'POST',body:JSON.stringify(entry)});loadFoods(true);pendingId=null;form.hidden=true;await loadDay();status.textContent=loaded?'Portion saved to your account.':'Portion saved. Retry the diary to refresh your daily totals.';}catch(e){failure(e);}finally{saving=false;$('food-camera').disabled=false;date.disabled=false;$('food-manual').disabled=false;$('food-find').disabled=false;form.querySelectorAll('input,select,button').forEach(n=>n.disabled=false);$('food-log').disabled=!loaded;}
  };
  window.addEventListener('nutrition-open',()=>{if(page.hidden)return;clear();loadDay();loadFoods();});
  if(location.pathname.replace(/\/$/,'')==='/nutrition'){loadDay();loadFoods();}
  const cameraDialog=$('food-camera-dialog'),cameraStatus=$('food-camera-status'),video=$('food-camera-video');
  let scannerControls=null,cameraRevision=0,photoData=null,photoURL=null,readerLoading=null;
  function reader(){
    if(window.ZXingBrowser)return Promise.resolve(new window.ZXingBrowser.BrowserMultiFormatOneDReader());
    readerLoading ||= new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/barcode-reader.js';script.onload=()=>window.ZXingBrowser?resolve():reject(new Error('Barcode reader could not load.'));script.onerror=()=>reject(new Error('Barcode reader could not load. Type the barcode instead.'));document.head.append(script);}).catch(e=>{readerLoading=null;throw e;});
    return readerLoading.then(()=>new window.ZXingBrowser.BrowserMultiFormatOneDReader());
  }
  function stopCamera(){
    cameraRevision++;scannerControls?.stop();scannerControls=null;
    const stream=video.srcObject;stream?.getTracks().forEach(track=>track.stop());video.srcObject=null;
    $('food-scanner-view').hidden=true;$('food-scan-stop').hidden=true;
  }
  function clearPhoto(){photoData=null;if(photoURL)URL.revokeObjectURL(photoURL);photoURL=null;$('food-photo-preview').removeAttribute('src');$('food-photo-preview').hidden=true;$('food-photo-identify').hidden=true;$('food-photo-notice').hidden=true;}
  function acceptBarcode(code){
    if(!/^(?:\d{8}|\d{12,14})$/.test(code))return false;
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
    try{
      const codeReader=await reader();if(revision!==cameraRevision||!cameraDialog.open)return;
      $('food-scanner-view').hidden=false;$('food-scan-stop').hidden=false;
      const controls=await codeReader.decodeFromVideoDevice(undefined,video,(result,err,controls)=>{
        if(revision!==cameraRevision){controls.stop();return;}
        if(result){if(!acceptBarcode(result.getText()))cameraStatus.textContent='This is not a product barcode. Scan the barcode printed on the package.';}
      });
      if(revision!==cameraRevision||!cameraDialog.open){controls.stop();video.srcObject?.getTracks().forEach(t=>t.stop());return;}
      scannerControls=controls;cameraStatus.textContent='Point the rear camera at a product barcode. Recognition starts automatically.';
    }catch(e){if(revision===cameraRevision){stopCamera();cameraStatus.textContent=e.name==='NotAllowedError'?'Camera access was not allowed. Choose a picture or enable camera access in your browser.':e.name==='NotFoundError'?'No camera was found. Choose a picture instead.':'Could not start the scanner. Choose a clear barcode picture or type the digits instead.';}}
    finally{$('food-scan-start').disabled=false;}
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
      const canvas=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      photoData=canvas.toDataURL('image/jpeg',0.85).split(',')[1];$('food-photo-preview').src=photoURL;$('food-photo-preview').hidden=false;
      try{const codeReader=await reader();if(revision!==cameraRevision)return;const result=codeReader.decodeFromCanvas(canvas);if(acceptBarcode(result.getText()))return;}catch{}
      if(revision!==cameraRevision||!cameraDialog.open)return;
      cameraStatus.textContent='For a barcode, try a closer, sharper picture. For food, choose Identify food.';$('food-photo-identify').hidden=false;$('food-photo-notice').hidden=false;
    }catch{if(revision===cameraRevision){clearPhoto();cameraStatus.textContent='This picture could not be opened. Try a JPEG, PNG or WebP image.';}}
  }
  $('food-picture-input').onchange=choosePicture;$('food-camera-input').onchange=choosePicture;
  $('food-photo-identify').onclick=()=>{if(!photoData)return;const image=photoData;cameraDialog.close();findFood('photo',{image,mimeType:'image/jpeg'});};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopCamera();if(cameraDialog.open)cameraStatus.textContent='Camera paused. Tap Scan barcode to resume.';}});
  new MutationObserver(()=>{if(page.hidden&&cameraDialog.open)cameraDialog.close();}).observe(page,{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('pagehide',stopCamera);

})();
