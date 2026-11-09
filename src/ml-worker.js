import {loadSVM,predictSVM,acceptImage,imageTensor,normalizedFeatures,roundEven} from '/ml-core.js';
const manifest=__ML_MANIFEST__;
const root='/ml-assets/'+manifest.version+'/',cacheName='food-ml-'+manifest.version;
let modelPromise;
const progress=message=>postMessage({type:'progress',message});
async function verifiedAsset(name){
  const expected=manifest.assets[name];if(!expected)throw Error('Unknown model asset');
  const url=root+name;let cache,response;
  try{cache=await caches.open(cacheName);response=await cache.match(url);}catch{}
  if(!response){response=await fetch(url,{credentials:'same-origin'});if(!response.ok)throw Error('Model files are not available.');}
  const raw=await response.arrayBuffer();
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',raw))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(raw.byteLength!==expected.size||hash!==expected.sha256){try{await cache?.delete(url);}catch{}throw Error('Model file verification failed.');}
  try{await cache?.put(url,new Response(raw,{headers:{'content-type':expected.type}}));}catch{}
  return raw;
}
async function init(){
  progress('Loading the photo model. The first download is cached on this device…');
  const meta=JSON.parse(new TextDecoder().decode(await verifiedAsset('svm.json'))),buffer=new ArrayBuffer(meta.bytes),all=new Uint8Array(buffer);
  let loaded=0;
  for(const part of meta.parts){all.set(new Uint8Array(await verifiedAsset(part.name)),part.offset);loaded+=part.size;progress('Preparing photo model · '+Math.round(loaded/1048576)+' MB loaded');}
  const ort=await import(root+'ort.wasm.min.mjs');
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths=root;
  progress('Starting local photo recognition…');
  const session=await ort.InferenceSession.create(await verifiedAsset('encoder.onnx'),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  return {svm:loadSVM(meta,buffer),ort,session};
}
async function features(rgb,width,height,loaded){
  const input=imageTensor(rgb,width,height),output=await loaded.session.run({[loaded.session.inputNames[0]]:new loaded.ort.Tensor('float32',input,[1,3,224,224])});
  return normalizedFeatures(output[loaded.session.outputNames[0]].data);
}
onmessage=async({data})=>{
  const {id,image,mimeType}=data;
  try{
    modelPromise ||= init().catch(e=>{modelPromise=null;throw e;});
    const loaded=await modelPromise;
    const binary=Uint8Array.from(atob(image),c=>c.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([binary],{type:mimeType}),{imageOrientation:'from-image'});
    const width=bitmap.width,height=bitmap.height;
    if(width*height>4000000){bitmap.close();throw Error('Photo is too large for local recognition.');}
    const canvas=new OffscreenCanvas(width,height),context=canvas.getContext('2d',{willReadFrequently:true});
    context.drawImage(bitmap,0,0);bitmap.close();
    const rgba=context.getImageData(0,0,width,height).data,rgb=new Uint8Array(width*height*3);
    for(let p=0;p<width*height;p++){rgb[p*3]=rgba[p*4];rgb[p*3+1]=rgba[p*4+1];rgb[p*3+2]=rgba[p*4+2];}
    progress('Recognizing food on this device…');
    const whole=predictSVM(loaded.svm,await features(rgb,width,height,loaded));
    const left=roundEven(width*.15),top=roundEven(height*.15),right=roundEven(width*.85),bottom=roundEven(height*.85),cw=right-left,ch=bottom-top,crop=new Uint8Array(cw*ch*3);
    for(let y=0;y<ch;y++)crop.set(rgb.subarray(((y+top)*width+left)*3,((y+top)*width+right)*3),y*cw*3);
    const center=predictSVM(loaded.svm,await features(crop,cw,ch,loaded),false);
    const accepted=acceptImage(whole,center,loaded.svm.meta.distanceLimit);
    postMessage({id,type:'result',data:{candidates:accepted?[{name:loaded.svm.meta.classes[whole.top],source:'ML',confidence:whole.confidence,score_kind:'calibrated recognition confidence',reason:'Recognized locally on your device. Confirm the food before logging.'}]:[],fallback_reason:accepted?null:'The local model did not pass confidence, crop-consistency or unfamiliar-image checks.'}});
  }catch{postMessage({id,type:'result',data:{candidates:[],fallback_reason:'Local recognition could not run on this device.'}});}
};
