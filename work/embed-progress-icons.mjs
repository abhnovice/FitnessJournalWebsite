import fs from 'node:fs';

const indexPath = new URL('./site/dist/index.html', import.meta.url);
const serverPath = new URL('./site/dist/server/index.js', import.meta.url);
const iconDir = new URL('./site/assets/progression-icons/', import.meta.url);

const variables = Array.from({ length: 16 }, (_, index) => {
  const row = Math.floor(index / 4);
  const stage = index % 4;
  const file = new URL(`icon-${String(index).padStart(2, '0')}.png`, iconDir);
  const data = fs.readFileSync(file).toString('base64');
  return `--tc-progress-${row}${stage}:url(&#x27;data:image/png;base64,${data}&#x27;);`;
}).join('');

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/--tc-progress-sprite:url\(&#x27;data:image\/png;base64,[A-Za-z0-9+/=]+&#x27;\);/, variables);
html = html.replace(
  '#training-checklist-v1 .tc-progress-icon{display:inline-block;width:42px;height:42px;flex:none;background-image:var(--tc-progress-sprite);background-repeat:no-repeat;background-size:400% 400%;filter:drop-shadow(0 2px 2px #0002)}',
  '#training-checklist-v1 .tc-progress-icon{display:inline-block;width:42px;height:42px;flex:none;align-self:center;background-image:var(--tc-icon);background-repeat:no-repeat;background-position:center;background-size:contain;transform:scale(var(--tc-icon-scale,1));transform-origin:center;filter:drop-shadow(0 2px 2px #0002)}'
);
html = html.replace(
  '#training-checklist-v1 .tc-week&gt;summary .tc-progress-icon{width:40px;height:40px;margin:-7px 1px -7px 0}',
  '#training-checklist-v1 .tc-week&gt;summary .tc-progress-icon{width:40px;height:40px;margin:-4px 1px;}'
);

const oldFunction = `  function progressionIcon(id,weekOrdinal){
    const span=document.createElement(&#x27;span&#x27;);span.className=&#x27;tc-progress-icon&#x27;;span.setAttribute(&#x27;aria-hidden&#x27;,&#x27;true&#x27;);
    const row=id===&#x27;launchpad&#x27;?0:id===&#x27;cardio&#x27;?1:id===&#x27;circuit&#x27;?2:id===&#x27;gladiator-1&#x27;?1:id===&#x27;gladiator-2&#x27;?3:id.startsWith(&#x27;gladiator&#x27;)?3:3;
    const stage=Math.min(3,Math.floor(Math.max(0,weekOrdinal)/(totalPlanWeeks-1)*4));span.style.backgroundPosition=(stage*100/3)+&#x27;% &#x27;+(row*100/3)+&#x27;%&#x27;;return span;
  }`;
const newFunction = `  function progressionIcon(id,weekOrdinal){
    const span=document.createElement(&#x27;span&#x27;);span.className=&#x27;tc-progress-icon&#x27;;span.setAttribute(&#x27;aria-hidden&#x27;,&#x27;true&#x27;);
    const row=id===&#x27;launchpad&#x27;?0:id===&#x27;cardio&#x27;?1:id===&#x27;circuit&#x27;?2:id===&#x27;gladiator-1&#x27;?1:3;
    const phase=phases.find(item=&gt;item.id===id);const localWeek=Math.max(0,weekOrdinal-phaseStartWeek(phase));const localProgress=localWeek/Math.max(1,phase.weeks-1);
    const ranges={launchpad:[0,0],cardio:[0,1],circuit:[1,2],&#x27;gladiator-1&#x27;:[1,2],&#x27;gladiator-2&#x27;:[1,2],&#x27;gladiator-3&#x27;:[2,2],&#x27;gladiator-4&#x27;:[2,3],&#x27;gladiator-5&#x27;:[3,3],&#x27;gladiator-6&#x27;:[3,3]};
    const range=ranges[id]||[3,3];const stage=Math.max(0,Math.min(3,Math.round(range[0]+(range[1]-range[0])*localProgress)));
    const overallProgress=Math.max(0,Math.min(1,weekOrdinal/Math.max(1,totalPlanWeeks-1)));span.style.setProperty(&#x27;--tc-icon&#x27;,&#x27;var(--tc-progress-&#x27;+row+stage+&#x27;)&#x27;);span.style.setProperty(&#x27;--tc-icon-scale&#x27;,(.92+overallProgress*.13).toFixed(3));span.dataset.progressWeek=String(weekOrdinal+1);return span;
  }`;
if (!html.includes(oldFunction)) throw new Error('Existing progressionIcon implementation not found');
html = html.replace(oldFunction, newFunction);

fs.writeFileSync(indexPath, html);
let server = fs.readFileSync(serverPath, 'utf8');
const newline = server.indexOf('\n');
server = `const PAGE_HTML = ${JSON.stringify(html)};${server.slice(newline)}`;
fs.writeFileSync(serverPath, server);
