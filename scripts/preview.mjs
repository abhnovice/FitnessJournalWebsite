import {createServer} from 'node:http';
import {mkdirSync} from 'node:fs';
import worker from '../dist/server/index.js';
import {database} from './sqlite-d1.mjs';
mkdirSync('.preview',{recursive:true});const DB=database('.preview/nutrition.sqlite');DB.migrate();
const server=createServer(async(req,res)=>{
  try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const method=req.method,headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','local-preview-user');const request=new Request('http://127.0.0.1:4173'+req.url,{method,headers,body:['GET','HEAD'].includes(method)?undefined:Buffer.concat(chunks)});const response=await worker.fetch(request,{DB,GEMINI_API_KEY:process.env.GEMINI_API_KEY,BARCODE_API:process.env.BARCODE_API,GEMINI_MODEL:process.env.GEMINI_MODEL});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Local preview failed.');}
});
server.listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173 — manual logging uses an isolated local diary.'));
