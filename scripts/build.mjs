import {baselineMeals} from '../src/baseline.mjs';
import {drinkGroups} from '../src/drinks.mjs';
import {PLAN_REVISION} from '../src/training-plan.mjs';
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync,rmSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const strip=s=>s.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const mlManifest=read('src/ml-manifest.json');
const mlWorker=read('src/ml-worker.js').replace('__ML_MANIFEST__',()=>mlManifest);
const mlConstants='const ML_MANIFEST = '+mlManifest+';\nconst ML_CORE_JS = '+JSON.stringify(read('src/ml-core.mjs'))+';\nconst ML_WORKER_JS = '+JSON.stringify(mlWorker)+';\nconst catalog = '+read('src/food-catalog.json')+';\n'+strip(read('src/drinks.mjs'))+'\n'+strip(read('src/food-lookup.mjs'))+'\n'+strip(read('src/ml-assets.mjs'))+'\n';
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
const fluentIcon=name=>read('assets/fluent-icons/'+name+'.svg').replace(/fill="#[^"]+"/g,'fill="currentColor"').replace('<svg ','<svg aria-hidden="true" focusable="false" ');
const headerIcons=Object.fromEntries(Object.entries({home:'home',foundation:'clipboard_checkmark',nutrition:'food_apple','body-stats':'data_usage',workouts:'dumbbell',more:'navigation',...Object.fromEntries(Array.from({length:6},(_,i)=>['gladiator-'+i,'dumbbell'])),...Object.fromEntries(Array.from({length:8},(_,i)=>['byow-'+i,'target']))}).map(([page,icon])=>[page,fluentIcon(icon)]));
const drinkOptions = Object.entries(drinkGroups).map(([group, drinks]) =>
  '<optgroup label="'+escape(group)+'">'+drinks.map(({name})=>'<option>'+escape(name)+'</option>').join('')+'</optgroup>'
).join('');
const page=read('src/page.html').replace('__HOME_HEADER_ICON__',()=>headerIcons.home).replace('__HEADER_ICONS__',()=>JSON.stringify(headerIcons)).replace('__PLAN_REVISION__',()=>JSON.stringify(PLAN_REVISION)).replace('__JOURNAL_HTML__',()=>escape(read('src/journal.html').replace('__BASELINE_MEALS__',()=>baselineMeals.map(m=>'<article><h3>'+escape(m.label)+'</h3><p>'+escape(m.plan)+'</p></article>').join('')).replace('__TRAINING_PLAN__',()=>read('src/training-plan.mjs').replace(/^export /gm,'')))).replace('__NUTRITION_HTML__',()=>read('src/nutrition.html').replace('__DRINK_OPTIONS__',()=>drinkOptions)).replace('__NUTRITION_UI__',()=>strip(read('src/photo-review.mjs'))+'\n'+strip(read('src/baseline.mjs'))+'\n'+read('src/nutrition-ui.js')+'\n'+read('src/adherence-ui.js'));
mkdirSync('dist/server',{recursive:true});
writeFileSync('dist/server/package.json',JSON.stringify({type:'module'})+'\n');
rmSync('dist/server/package-lock.json',{force:true});
writeFileSync('dist/index.html',page);
writeFileSync('dist/server/index.js','const PLAN_REVISION = '+JSON.stringify(PLAN_REVISION)+';\nconst BARCODE_READER_JS = '+JSON.stringify(read('src/vendor/zxing-browser.min.js'))+';\nconst PAGE_HTML = '+JSON.stringify(page)+';\n'+mlConstants+strip(read('src/baseline.mjs'))+'\n'+strip(read('src/adherence.mjs'))+'\n'+strip(read('src/diary-proof.mjs'))+'\n'+strip(read('src/nutrition.mjs'))+'\n'+strip(read('src/coach.mjs'))+'\n'+read('src/worker.mjs'));
// These production assets are also embedded in the Worker. Copy source artwork
// for portable local previews and archive inspection when available.
for(const file of ['stronger-self-icon.webp','home-fit-icon.png','body-stats-character-v1.png','cheering-character-v1.png','dashboard-dumbbell-v1.png','dashboard-pullup-v1.png','dashboard-squat-v1.png','dashboard-treadmill-v1.png']){
  if(existsSync('assets/'+file))copyFileSync('assets/'+file,'dist/'+file);
}
console.log('Built journal, nutrition UI and Worker.');
