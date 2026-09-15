/* Current-view residency. The distant shell uses its numeric palette; image maps
 * enter the cache only inside their visible distance bands. No launch-time atlas. */
(function(root){
'use strict';
const managers={biomes:'Surface detail',heroes:'Landscape artwork',worldTextures:'Builder materials',woundTextures:'Wound artwork'};
function plan(s,aspect=16/9){
 const M=root.SphereMath,B=root.SphereBiomes,W=root.SphereWorld,C=root.SphereCollection,sets=Object.fromEntries(Object.keys(managers).map(k=>[k,new Set()]));let nearest=Infinity;
 const add=(id,distance)=>{if(!Number.isInteger(id)||id<0)return;if(id<10){if(distance<2400)sets.heroes.add(id);if(distance<(s.layoutVersion===2?25:2400))sets.biomes.add(id);}else if(distance<6000)sets.worldTextures.add(id===15?4:Math.min(4,id-10));};
 const modern=s.collection&&s.layoutVersion===2,exterior=s.geometryDetail&&s.siteId?.startsWith('exterior-');
 if(s.textureDetail!==false){
  const b=M.basis(s.forward,s.up),nx=s.projection==='panorama'?16:5,ny=s.projection==='panorama'?9:5;
  // A nearby Shade can be millions of kilometres above the shell.
  const closeShell=Math.abs(s.radius-M.length(s.position))<21000,closeShade=s.collection&&C.plates(s).some(p=>{
   // A perpendicular probe misses when approaching from outside the perimeter
   // or through a fracture. Include a conservative neighbourhood of the whole
   // footprint, then use view rays to choose the actual requested artwork.
   const r=M.length(p.center)*s.radius,z=M.dot(s.position,p.normal),curved=p.shape==='cap'||p.shape==='trimmed',height=Math.abs((curved?M.length(s.position):z)-r);if(z<=0||height>21000)return false;
   const factor=curved?r/z:1;return Math.abs(M.dot(s.position,p.right)*factor)<p.size*(p.across||1)*s.radius+21000&&Math.abs(M.dot(s.position,p.up)*factor)<p.size*s.radius+21000;
  });
  if(closeShell||closeShade||Number.isInteger(s.shadeAttachment)){for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
   const d=M.ray(x/(nx-1)*2-1,y/(ny-1)*2-1,aspect,s.fov,b,s.projection==='panorama'),hit=M.trace(s.position,d,s);nearest=Math.min(nearest,hit.distance);
   if(hit.kind.startsWith('Shade')&&hit.distance<21000){sets.worldTextures.add(3);sets.worldTextures.add(4);}
   if(hit.kind==='Inner surface'&&hit.point&&hit.distance<6000){const q=M.norm(hit.point);if(modern&&s.biome<0){const r=W.sample(q,s);add(r.a,hit.distance);if(r.blend>.001)add(r.b,hit.distance);}else add(B.region(q,s),hit.distance);}
  }}
  if(modern&&exterior){for(const id of [0,3,4,5,7])sets.heroes.add(id);sets.worldTextures.add(2);}
  if(modern&&s.era==='after'&&s.multipleWounds){const ctx=root.SphereEdges.rimContext(s);if(ctx){sets.worldTextures.add(2);for(const q of [M.norm(s.position),ctx.point,...[-500,500].map(k=>M.norm(M.add(ctx.point,M.mul(ctx.tangent,k/s.radius))))]){const r=W.sample(q,s);sets.woundTextures.add(W.edgeBiome(r.a));sets.woundTextures.add(W.edgeBiome(r.b));}}}
 }
 return {...Object.fromEntries(Object.entries(sets).map(([key,ids])=>[key,[...ids].filter(id=>Number.isInteger(id)&&id>=0).sort((a,b)=>a-b)])),finishes:modern&&s.richMaterials!==false&&(nearest<300||exterior||s.walkMode),province:!!(s.geometryDetail&&root.SphereWatershed?.visible(s))};
}
function pipelineKey(s,p){const altitude=s.radius-root.SphereMath.length(s.position),weather=s.layoutVersion!==2||!s.collection?'none':s.atmosphere>0&&altitude>=0?(altitude<160?'local':'far'):s.cavityHaze>0?'dust':'none';return [s.collection&&s.layoutVersion===2?'modern':'legacy',weather,!!p.province,!!s.siteId,s.projection].join('|');}
function pipelineReady(renderer,s,p){
 const modern=s.collection&&s.layoutVersion===2;if(!(modern?renderer.modernProgram:renderer.legacyProgram))return false;
 const mode=pipelineKey(s,p).split('|')[1],weather=renderer.weather;
 if(renderer.linearSupported!==false&&weather&&mode!=='none'&&!weather[mode==='local'?'program':mode==='far'?'farProgram':'dustProgram'])return false;
 if(modern&&s.geometryDetail&&!renderer.geometry&&root.SphereSites?.geometry(s).length)return false;
 return true;
}
function rows(renderer,p){return Object.keys(managers).flatMap(key=>p[key].map(id=>({key,id,label:managers[key],status:renderer[key]?.status[id]||'unloaded'})));}
function status(renderer,p){const all=rows(renderer,p);return {total:all.length,ready:all.filter(x=>x.status==='ready').length,failed:all.filter(x=>x.status==='failed'),missing:all.filter(x=>x.status!=='ready')};}
function request(renderer,p){for(const key of Object.keys(managers))for(const id of p[key])renderer[key]?.request(id);}
async function prepareMaps(manager,ids=[],label='Artwork',options={}){
 const wanted=[...new Set(ids)];for(const id of wanted)manager.request(id);const start=performance.now();
 while(wanted.some(id=>!['ready','failed'].includes(manager.status[id]))){
  if(options.signal?.aborted)throw new DOMException('View changed','AbortError');manager.upload?.();options.onProgress?.();
  if(performance.now()-start>60000)throw Error(label+' is taking longer than expected. Check the local server, then retry.');await new Promise(r=>setTimeout(r,20));
 }
 options.onProgress?.();const failed=wanted.filter(id=>manager.status[id]==='failed');if(failed.length)throw Error(label+' could not load. Retry, or continue with the simpler surface.');
}
function retry(renderer,p){for(const key of Object.keys(managers))for(const id of p[key])if(renderer[key]?.status[id]==='failed')renderer[key].status[id]='unloaded';}
root.SphereAssets={plan,status,request,retry,prepareMaps,pipelineKey,pipelineReady};
})(typeof window==='undefined'?globalThis:window);
