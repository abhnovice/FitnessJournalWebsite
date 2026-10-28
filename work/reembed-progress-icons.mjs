import fs from 'node:fs';

const indexPath = new URL('./site/dist/index.html', import.meta.url);
const serverPath = new URL('./site/dist/server/index.js', import.meta.url);
const iconDir = new URL('./site/assets/progression-icons/', import.meta.url);

const variables = Array.from({ length: 16 }, (_, index) => {
  const row = Math.floor(index / 4);
  const stage = index % 4;
  const file = new URL(`icon-${String(index).padStart(2, '0')}.png`, iconDir);
  return `--tc-progress-${row}${stage}:url(&#x27;data:image/png;base64,${fs.readFileSync(file).toString('base64')}&#x27;);`;
}).join('');

let html = fs.readFileSync(indexPath, 'utf8');
const pattern = /--tc-progress-00:url\(&#x27;data:image\/png;base64,[A-Za-z0-9+/=]+&#x27;\);.*?--tc-progress-33:url\(&#x27;data:image\/png;base64,[A-Za-z0-9+/=]+&#x27;\);/;
if (!pattern.test(html)) throw new Error('Embedded progression icon variables not found');
html = html.replace(pattern, variables);
fs.writeFileSync(indexPath, html);

let server = fs.readFileSync(serverPath, 'utf8');
const newline = server.indexOf('\n');
server = `const PAGE_HTML = ${JSON.stringify(html)};${server.slice(newline)}`;
fs.writeFileSync(serverPath, server);
