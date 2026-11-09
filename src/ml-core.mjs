// Numeric inference port of Nutrition-Module's deep_svc/model_votes/rejection_checks.
// Scores are calibrated top-1 correctness, never softmax confidence per class.
export function loadSVM(meta, buffer){
  const arrays={};
  for(const [name,a] of Object.entries(meta.arrays)){
    const Type=a.dtype==='<f4'?Float32Array:a.dtype==='<f8'?Float64Array:a.dtype==='<u4'?Uint32Array:null;
    if(!Type||a.offset%Type.BYTES_PER_ELEMENT||a.offset+a.length*Type.BYTES_PER_ELEMENT>buffer.byteLength)throw Error('Invalid model array');
    arrays[name]=new Type(buffer,a.offset,a.length);
  }
  return {meta,...arrays};
}
export function predictSVM(model, vector, novelty=true){
  const {meta,x,support,dual,intercept,mean,scale}=model, dim=meta.features,n=meta.classes.length,sv=support.length;
  if(vector.length!==dim)throw Error('Invalid image features');
  const kernels=new Float64Array(sv),scaled=new Float32Array(dim),supportMap=new Int32Array(meta.rows).fill(-1);
  for(let i=0;i<sv;i++)supportMap[support[i]]=i;
  if(novelty)for(let j=0;j<dim;j++)scaled[j]=Math.fround(Math.fround(vector[j]-mean[j])/scale[j]);
  let nearest=Infinity;
  for(let row=0;row<meta.rows;row++){
    const index=supportMap[row];if(!novelty&&index<0)continue;
    let squared=0,distance=0,offset=row*dim;
    for(let j=0;j<dim;j++){
      const value=x[offset+j];
      if(index>=0){const delta=vector[j]-value;squared+=delta*delta;}
      if(novelty){const delta=scaled[j]-Math.fround(Math.fround(value-mean[j])/scale[j]);distance+=delta*delta;}
    }
    if(index>=0)kernels[index]=Math.exp(-meta.gamma*squared);
    if(distance<nearest)nearest=distance;
  }
  const starts=[0];for(const count of meta.counts)starts.push(starts.at(-1)+count);
  const votes=new Float64Array(n),sums=new Float64Array(n);let pair=0;
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    let decision=intercept[pair++];
    for(let k=starts[i];k<starts[i+1];k++)decision+=dual[(j-1)*sv+k]*kernels[k];
    for(let k=starts[j];k<starts[j+1];k++)decision+=dual[i*sv+k]*kernels[k];
    votes[decision>=0?i:j]++;sums[i]+=decision;sums[j]-=decision;
  }
  const scores=Array.from(votes,(v,i)=>v+sums[i]/(3*(Math.abs(sums[i])+1))),max=Math.max(...scores);
  const probabilities=scores.map(s=>Math.exp(s-max)),total=probabilities.reduce((a,b)=>a+b,0);
  let top=0,entropy=0;
  for(let i=0;i<n;i++){probabilities[i]/=total;if(probabilities[i]>probabilities[top])top=i;entropy-=probabilities[i]*Math.log(Math.max(probabilities[i],1e-12));}
  const ordered=[...probabilities].sort((a,b)=>b-a),risk=[ordered[0],ordered[0]-ordered[1],entropy/Math.log(n)];
  const logit=Math.max(-40,Math.min(40,risk.reduce((s,v,i)=>s+v*meta.risk[i],meta.riskIntercept)));
  return {top,confidence:1/(1+Math.exp(-logit)),distance:novelty?Math.sqrt(nearest/dim):null};
}
export function acceptImage(whole,center,limit){return Number.isFinite(whole.confidence)&&whole.confidence>.60&&whole.top===center.top&&whole.distance<=limit;}
// Pillow's bilinear downsampling uses a widened triangular filter and 22-bit
// fixed-point coefficients, with rounding after each separable pass.
function coefficients(input,output){
  const scale=input/output,filter=Math.max(1,scale),support=filter;
  return Array.from({length:output},(_,i)=>{
    const center=(i+.5)*scale,start=Math.max(0,Math.floor(center-support+.5)),end=Math.min(input,Math.floor(center+support+.5));
    const weights=[];let sum=0;
    for(let j=start;j<end;j++){const w=Math.max(0,1-Math.abs((j-center+.5)/filter));weights.push(w);sum+=w;}
    return {start,weights:weights.map(w=>Math.floor(w/sum*4194304+.5))};
  });
}
export function resizeRGB(rgb,width,height,target=224){
  const horizontal=coefficients(width,target),vertical=coefficients(height,target),temp=new Uint8Array(target*height*3),out=new Uint8Array(target*target*3);
  for(let y=0;y<height;y++)for(let x=0;x<target;x++)for(let c=0;c<3;c++){
    const a=horizontal[x];let sum=2097152;
    for(let i=0;i<a.weights.length;i++)sum+=rgb[(y*width+a.start+i)*3+c]*a.weights[i];
    temp[(y*target+x)*3+c]=Math.max(0,Math.min(255,Math.floor(sum/4194304)));
  }
  for(let y=0;y<target;y++)for(let x=0;x<target;x++)for(let c=0;c<3;c++){
    const a=vertical[y];let sum=2097152;
    for(let i=0;i<a.weights.length;i++)sum+=temp[((a.start+i)*target+x)*3+c]*a.weights[i];
    out[(y*target+x)*3+c]=Math.max(0,Math.min(255,Math.floor(sum/4194304)));
  }
  return out;
}
export function imageTensor(rgb,width,height){
  const resized=resizeRGB(rgb,width,height),tensor=new Float32Array(3*224*224),means=new Float32Array([.485,.456,.406]),stds=new Float32Array([.229,.224,.225]);
  for(let i=0;i<224*224;i++)for(let c=0;c<3;c++)tensor[c*224*224+i]=Math.fround(Math.fround(Math.fround(resized[i*3+c]/255)-means[c])/stds[c]);
  return tensor;
}
export function normalizedFeatures(values){
  // NumPy accumulates a float32 norm for the source's float32 encoder output.
  let norm=0;for(const v of values)norm+=v*v;norm=Math.sqrt(norm);
  return Float32Array.from(values,v=>v/Math.max(norm,1e-12));
}
export function roundEven(v){const f=Math.floor(v);return v-f===.5?(f%2===0?f:f+1):Math.round(v);}
