import fs from 'node:fs';

const indexPath = new URL('./site/dist/index.html', import.meta.url);
const serverPath = new URL('./site/dist/server/index.js', import.meta.url);
const imagePath = new URL('./site/assets/fitness-hill-journey-v1.jpg', import.meta.url);

const encoded = fs.readFileSync(imagePath).toString('base64');
let html = fs.readFileSync(indexPath, 'utf8');
const heroPattern = /(\.tc-hero\{[^}]*background:#1b3347 url\(&#x27;data:image\/jpeg;base64,)[A-Za-z0-9+/=]+(&#x27;\))/;
if (!heroPattern.test(html)) throw new Error('Hero image data URL was not found');
html = html.replace(heroPattern, `$1${encoded}$2`);
fs.writeFileSync(indexPath, html);

let server = fs.readFileSync(serverPath, 'utf8');
const newline = server.indexOf('\n');
server = `const PAGE_HTML = ${JSON.stringify(html)};${server.slice(newline)}`;
fs.writeFileSync(serverPath, server);
