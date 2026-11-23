(() => {
  const get = id => document.getElementById(id);
  const date = get('food-date'), list = get('baseline-meals'), status = get('baseline-status');
  const generate = get('baseline-generate'), result = get('baseline-result'), count = get('baseline-count');
  const retry = get('baseline-retry');
  const statusLabels = {visible:'visible', partial:'partial match', unclear:'unclear', absent:'not seen'};
  const rows = new Map();
  let sequence = 0, state = null, busy = false;
  const endpoint = (day, meal) => '/api/nutrition/adherence'+(meal?'/photo':'')+
    '?date='+encodeURIComponent(day)+(meal?'&meal='+encodeURIComponent(meal):'');
  function node(tag,content,parent) {
    const element = document.createElement(tag);
    if(content) element.textContent = content;
    parent.append(element);
    return element;
  }
  async function request(url,options={}) {
    const response = await fetch(url,{cache:'no-store',...options});
    const data = await response.json();
    if(!response.ok) throw Error(data.error || 'Could not complete the request. Please retry.');
    return data;
  }
  async function jpeg(file) {
    const image = new Image(), url = URL.createObjectURL(file);
    try {
      image.src = url;
      await image.decode();
      const scale = Math.min(1,1200/Math.max(image.width,image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(image.width*scale));
      canvas.height = Math.max(1,Math.round(image.height*scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      const blob = await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.78));
      if(!blob) throw Error();
      return blob;
    } catch { throw Error('Could not open this picture. Try a JPEG, PNG or WebP photo.'); }
    finally { URL.revokeObjectURL(url); }
  }
  function render() {
    const report = state?.report;
    const total = Object.keys(state?.photos || {}).length;
    count.textContent = state ? total+' of '+baselineMeals.length+' meals photographed' : '';
    result.hidden = !report;
    get('baseline-number').textContent = report ? report.score+'%' : '';
    generate.disabled = busy || !state;
    generate.textContent = report ? 'Review saved score' : 'Generate end-of-day score';
    for(const meal of baselineMeals) {
      const row = rows.get(meal.id), etag = state?.photos[meal.id];
      const url = etag && endpoint(date.value,meal.id)+'&v='+encodeURIComponent(etag);
      row.preview.hidden = !etag;
      if(url && row.preview.getAttribute('href')!==url) {
        row.preview.href=url;
        row.image.src=url;
      } else if(!url) {
        row.preview.removeAttribute('href');
        row.image.removeAttribute('src');
      }
      row.upload.disabled = row.remove.disabled = busy || !state;
      row.upload.textContent = etag ? 'Replace photo' : 'Add photo';
      row.remove.hidden = !etag;
      const review = report?.rows.find(r=>r.id===meal.id);
      row.review.replaceChildren();
      if(review) {
        node('strong',Math.round(review.fraction*100)+'% meal match',row.review);
        node('span',review.missing?'No photo for this meal.':review.observation,row.review);
        if(!review.missing) node('small',Object.entries(meal.foods).map(([id,name])=>name+' · '+statusLabels[review.matches[id]]).join(' / '),row.review);
      }
    }
  }
  async function load() {
    const version = ++sequence, day = date.value;
    state = null; busy = true; retry.hidden = true;
    status.textContent = day ? 'Loading meal photos…' : 'Choose a diary date.';
    render();
    if(!day) return;
    try {
      const data = await request(endpoint(day));
      if(version!==sequence) return;
      state = data; status.textContent = '';
    } catch(e) {
      if(version===sequence) {
        status.textContent = e.message;
        retry.hidden = false;
      }
    } finally { if(version===sequence) {busy=false;render();} }
  }
  async function act(meal,method,file) {
    if(busy || !state) return;
    const day = date.value, version = ++sequence;
    busy = true; retry.hidden = true;
    status.textContent = !meal?'Reviewing the day’s meal photos…':file?'Saving meal photo…':'Removing meal photo…';
    render();
    try {
      const options = {method};
      if(file) options.body = await jpeg(file);
      const response = await request(endpoint(day,meal),options);
      if(version!==sequence) return;
      if(meal) {await load();return;}
      state = response;
      status.textContent = 'End-of-day score saved.';
    } catch(e) {
      if(version===sequence) {status.textContent=e.message;retry.hidden=false;}
    } finally { if(version===sequence) {busy=false;render();} }
  }
  for(const meal of baselineMeals) {
    const item = node('article','',list);
    const header=node('div','',item);
    header.className='baseline-meal-head';
    node('h3',meal.label,header);
    node('p',meal.plan,item).className='food-muted';
    const controls = node('div','',item);
    controls.className='baseline-controls';
    const preview = node('a','',controls);
    preview.target='_blank';preview.rel='noopener';preview.hidden=true;
    const image = node('img','',preview);
    image.alt='View '+meal.label.toLowerCase()+' photo';
    const input=node('input','',controls);
    input.type='file';input.accept='image/*';input.hidden=true;
    const upload=node('button','Add photo',controls);
    upload.type='button';upload.disabled=true;upload.onclick=()=>input.click();
    upload.setAttribute('aria-label','Add or replace '+meal.label.toLowerCase()+' photo');
    input.onchange=()=>{const file=input.files[0];input.value='';if(file)act(meal.id,'POST',file);};
    const remove=node('button','Remove',controls);
    remove.className='baseline-remove';remove.type='button';remove.hidden=true;
    remove.setAttribute('aria-label','Remove '+meal.label.toLowerCase()+' photo');
    remove.onclick=()=>act(meal.id,'DELETE');
    const review=node('div','',item);review.className='baseline-review';
    rows.set(meal.id,{preview,image,upload,remove,review});
  }
  generate.onclick=()=>{if(state?.report)result.scrollIntoView({block:'center'});else act(null,'POST');};
  retry.onclick=load;
  date.addEventListener('change',load);
  window.addEventListener('nutrition-open',()=>{if(!busy)load();});
  if(location.pathname.replace(/\/$/,'')==='/nutrition') load();
})();
