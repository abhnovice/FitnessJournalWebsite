// Filesystem equivalent of the private meal-photo prefix for local development.
import {mkdir,readFile,readdir,rm,writeFile,rename} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {join,dirname} from 'node:path';

export function previewProofBucket(root,modelBucket) {
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  return {
    async list({prefix}) {
      const path = join(root,prefix);
      let files;
      try { files = await readdir(path); } catch(e) { if(e.code==='ENOENT')return {objects:[]};throw e; }
      const objects = await Promise.all(files.filter(f=>!f.startsWith('.')).map(async file=>({key:prefix+file,etag:hash(await readFile(join(path,file)))})));
      return {objects};
    },
    async get(key) {
      if(!key.startsWith('baseline/'))return modelBucket?.get(key) ?? null;
      let data;
      try {data=await readFile(join(root,key));} catch(e){if(e.code==='ENOENT')return null;throw e;}
      return {body:data,etag:hash(data),arrayBuffer:async()=>Uint8Array.from(data).buffer,json:async()=>JSON.parse(data.toString())};
    },
    async put(key,body) {
      const path=join(root,key), dir=dirname(path), temp=join(dir,'.'+randomUUID());
      await mkdir(dir,{recursive:true});await writeFile(temp,body);await rename(temp,path);
    },
    async delete(key) {await rm(join(root,key),{force:true});}
  };
}
