import {createServer} from 'node:http';
import {mkdirSync,readFileSync,existsSync} from 'node:fs';
import manifest from '../src/ml-manifest.json' with {type:'json'};
import {resolve} from 'node:path';
const modelRoot=process.env.MODEL_ASSET_DIR;
const modelBucket=modelRoot?{async get(key){const name=key.split('/').at(-1);if(!manifest.assets[name])return null;const path=resolve(modelRoot,name);return existsSync(path)?{body:readFileSync(path)}:null;}}:null;
import {previewProofBucket} from './preview-proofs.mjs';
const BUCKET=previewProofBucket('.preview/proofs',modelBucket);
import worker from '../dist/server/index.js';
import {database} from './sqlite-d1.mjs';
mkdirSync('.preview',{recursive:true});const DB=database('.preview/nutrition.sqlite');DB.migrate();
const server=createServer(async(req,res)=>{
  try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const method=req.method,headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','local-preview-user');const request=new Request('http://127.0.0.1:4173'+req.url,{method,headers,body:['GET','HEAD'].includes(method)?undefined:Buffer.concat(chunks)});const response=await worker.fetch(request,{DB,BUCKET,GROQ_API_KEY:process.env.GROQ_API_KEY,GEMINI_API_KEY:process.env.GEMINI_API_KEY,BARCODE_API:process.env.BARCODE_API,GEMINI_MODEL:process.env.GEMINI_MODEL});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Local preview failed.');}
});
server.listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173 — manual logging uses an isolated local diary.'));
