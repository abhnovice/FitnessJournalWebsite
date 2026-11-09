// This Site is owner-private. Sites validates browser/service access before
// dispatch. Uploads are additionally restricted to immutable, known SHA-256s.
export async function handleMLAsset(request,env,manifest){
  const url=new URL(request.url),prefix='/ml-assets/'+manifest.version+'/';
  if(!url.pathname.startsWith(prefix))return new Response('Not found',{status:404});
  const name=url.pathname.slice(prefix.length),asset=manifest.assets[name];
  if(!asset)return new Response('Not found',{status:404});
  if(!env.BUCKET)return new Response('Model storage unavailable',{status:503});
  const key='browser-nutrition/'+manifest.version+'/'+name;
  if(request.method==='PUT'){
    if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return new Response('Origin rejected',{status:403});
    if(Number(request.headers.get('content-length'))!==asset.size)return new Response('Invalid file size',{status:400});
    const raw=await request.arrayBuffer();
    if(raw.byteLength!==asset.size)return new Response('Invalid file size',{status:400});
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',raw))].map(x=>x.toString(16).padStart(2,'0')).join('');
    if(hash!==asset.sha256)return new Response('Invalid file checksum',{status:400});
    await env.BUCKET.put(key,raw,{httpMetadata:{contentType:asset.type},customMetadata:{sha256:hash}});
    return new Response(null,{status:204});
  }
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const object=await env.BUCKET.get(key);
  if(!object)return new Response('Model is preparing. Please retry shortly.',{status:503});
  return new Response(request.method==='HEAD'?null:object.body,{headers:{'content-type':asset.type,'content-length':String(asset.size),'cache-control':'private, max-age=31536000, immutable','x-content-type-options':'nosniff'}});
}
