// Own every allocation made by a pack on this WebGL context, including failures.
export class ResourceLease {
 constructor(gl,budget){
  if(!gl)throw Error('WebGL2 unavailable');this.gl=gl;this.budget=budget;this.live=new Map();this.originals=new Map();this.allocated={};this.deleted={};this.bound=new Map();this.bufferBytes=0;this.peakBufferBytes=0;this.disposed=false;
  for(const [kind,create,remove] of [['buffers','createBuffer','deleteBuffer'],['arrays','createVertexArray','deleteVertexArray'],['programs','createProgram','deleteProgram'],['shaders','createShader','deleteShader'],['textures','createTexture','deleteTexture'],['queries','createQuery','deleteQuery']]){
   this.live.set(kind,new Map());this.allocated[kind]=0;this.deleted[kind]=0;
   this.wrap(create,(original,...args)=>{if(this.disposed)throw Error('Pack resources released');const value=original(...args);if(!value)throw Error('Graphics allocation failed: '+kind);this.live.get(kind).set(value,0);this.allocated[kind]++;return value;});
   this.wrap(remove,(original,value)=>{if(this.live.get(kind).has(value)){if(kind==='buffers')this.bufferBytes-=this.live.get(kind).get(value);this.live.get(kind).delete(value);this.deleted[kind]++;}return original(value);});
  }
  this.wrap('bindBuffer',(original,target,value)=>{this.bound.set(target,value);return original(target,value);});
  this.wrap('bufferData',(original,target,data,...rest)=>{const buffer=this.bound.get(target),set=this.live.get('buffers');if(!set.has(buffer))throw Error('Buffer is not owned by this pack');const bytes=typeof data==='number'?data:data?.byteLength??0,newTotal=this.bufferBytes-set.get(buffer)+bytes;if(newTotal>budget.gpuBufferBytes)throw Error('Pack GPU buffer limit exceeded');const result=original(target,data,...rest);set.set(buffer,bytes);this.bufferBytes=newTotal;this.peakBufferBytes=Math.max(this.peakBufferBytes,newTotal);return result;});
  // This accepted pack allocates no GPU textures. Future adapters must add
  // measured texture accounting before requesting a nonzero texture budget.
  for(const method of ['texImage2D','texImage3D','texStorage2D','texStorage3D'])if(typeof gl[method]==='function')this.wrap(method,()=>{throw Error('GPU texture allocation has no accounting provider');});
 }
 wrap(name,fn){const original=this.gl[name].bind(this.gl);this.originals.set(name,this.gl[name]);this.gl[name]=(...args)=>fn(original,...args);}
 inspect(){const counts=Object.fromEntries([...this.live].map(([kind,set])=>[kind,set.size]));return {disposed:this.disposed,counts,liveResources:Object.values(counts).reduce((n,v)=>n+v,0),bufferBytes:this.bufferBytes,textureBytes:0,peakBufferBytes:this.peakBufferBytes,allocated:{...this.allocated},deleted:{...this.deleted}};}
 dispose(){if(this.disposed)return this.inspect();for(const [kind,remove] of [['queries','deleteQuery'],['arrays','deleteVertexArray'],['buffers','deleteBuffer'],['textures','deleteTexture'],['programs','deleteProgram'],['shaders','deleteShader']])for(const value of [...this.live.get(kind).keys()])this.gl[remove](value);this.bound.clear();this.disposed=true;const report=this.inspect();for(const [name,original] of this.originals)this.gl[name]=original;return report;}
}
