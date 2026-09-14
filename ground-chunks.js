/* Revision 2 connected shell terrain. Revision 0/1 generators remain in
 * field-sites.js. Shared parent coordinates, geographic samples and ownership
 * are independent of the camera, heading and residency history. Units: km. */
(function(root){
'use strict';const M=root.SphereMath,W=root.SphereWorld,S=root.SphereSites,C=root.SphereCollection;
const SIZE=1.024,FINE=64,COARSE=32,BUDGET=64*1048576,cache=new Map();let bytes=0,active=null,buildMs=0,target=null,worker=null,pending=null,generation=0,waits=0,revision=0,rebase=null,rebaseReady=null;
const enabled=s=>s.siteRevision===2&&s.siteAnchor&&/^(biome|port)-/.test(s.siteId)&&(s.walkMode||M.length(M.sub(s.position,M.mul(s.terrainAnchor||s.siteAnchor,s.radius)))<S.localRange(s));
function key(s){return JSON.stringify([s.terrainAnchor||s.siteAnchor,s.seed,s.radius,s.era,s.multipleWounds,s.shellThickness,s.provinceRevision,s.provinceSeed,s.provinceAnchor,s.packAddress,s.layoutVersion,s.axisLat,s.axisLon,s.waistWidth,s.transitionKm]);}
function frame(s){const anchor=s.terrainAnchor||s.siteAnchor,basis=S.shellFrame(anchor);return new S.Mesh(M.mul(anchor,s.radius),basis,'Connected terrain');}
function geographic(q,s){const sample=root.SphereWatershed?.sample(q,s);if(sample)return sample.terrainKm;
 const world=M.mul(q,s.radius),n=(scale,seed)=>{const p=world.map(v=>v*scale);return (S.noise(p[0],p[1],seed)+S.noise(p[1],p[2],seed+91)+S.noise(p[2],p[0],seed+173))/3;},region=W.sample(q,s);
 const extra=id=>id===2?.012*n(.14,s.seed+21):id===3?.016*n(.4,s.seed+27):0,relief=.002+n(.45,s.seed)*.008+n(2.5,s.seed+5)*.0002+extra(region.a)*(1-region.blend)+extra(region.b)*region.blend;
 // The preserved province reaches the analytic shell at its 320 km border.
 // Start new relief smoothly outside it; keep its original heights untouched.
 const province=root.SphereWatershed;
 if(province?.enabled(s)){const [x,z]=province.local(q,s);return relief*W.smooth(320,322,Math.max(Math.abs(x),Math.abs(z)));}
 return relief;
}
function height(s,f,x,z){const q=M.norm(f.world([x,0,z])),h=geographic(q,s);return h+(x*x+z*z)/(s.radius+Math.sqrt(Math.max(0,s.radius*s.radius-x*x-z*z)));}
function owner(x,z){return [Math.floor(x/SIZE),Math.floor(z/SIZE)];}
function bounds(s){const f=frame(s),p=f.local(s.position),[x,z]=owner(p[0],p[2]);return {x,z,f};}
function build(s,cx,cz,cells=FINE,centre=[cx,cz]){const f=frame(s),mesh=new S.Mesh(f.origin,f.basis,'Connected terrain · '+cx+','+cz),loX=(cells===COARSE&&cx===centre[0]-2?(centre[0]-1)*SIZE-16:cx*SIZE),loZ=(cells===COARSE&&cz===centre[1]-2?(centre[1]-1)*SIZE-16:cz*SIZE),spanX=cells===COARSE&&Math.abs(cx-centre[0])===2?16:SIZE,spanZ=cells===COARSE&&Math.abs(cz-centre[1])===2?16:SIZE,step=spanX/cells,stepZ=spanZ/cells;
 // The authored province already supplies connected land, water and gardens.
 // Its residency cells carry support ownership, never duplicate that mesh or
 // resample every river segment to generate a second invisible height field.
 if(root.SphereWatershed&&[[loX,loZ],[loX+spanX,loZ],[loX,loZ+spanZ],[loX+spanX,loZ+spanZ]].every(([x,z])=>root.SphereWatershed.sample(M.norm(f.world([x,0,z])),s))){mesh.finish();mesh.bvh=S.packBVH([]);delete mesh.triangles;mesh.ground={bounds:[loX,loZ,loX+spanX,loZ+spanZ],top:10,floor:S.packBVH([]),props:[],province:true};mesh.chunk={x:cx,z:cz,cells,revision:2};return mesh;}
 mesh.ground={bounds:[loX,loZ,loX+spanX,loZ+spanZ],top:10};const clip=S.woundGround(mesh,s),points=new Map(),sample=(x,z)=>{x=Math.round(x*1e9)/1e9;z=Math.round(z*1e9)/1e9;const id=x+','+z;if(!points.has(id)){const q=M.norm(f.world([x,0,z])),h=height(s,f,x,z),radial=(x*x+z*z)/(2*s.radius),r=Math.max(Math.abs(x-(centre[0]+.5)*SIZE),Math.abs(z-(centre[1]+.5)*SIZE)),fade=cells===COARSE?1-W.smooth(1.5*SIZE,1.5*SIZE+16,r):1;points.set(id,[x,radial+(h-radial)*fade,z]);}return points.get(id);};
 const triangle=(a,b,c)=>{const q=M.norm(f.world(M.mul(M.add(M.add(a,b),c),1/3)));if(root.SphereWatershed?.sample(q,s))return;const id=W.sample(q,s).biome;if(clip)clip.triangle(a,b,c,id);else mesh.tri(a,b,c,[1,1,1],id);};
 for(let j=0;j<cells;j++)for(let i=0;i<cells;i++){const x=loX+i*step,z=loZ+j*stepZ,a=sample(x,z),b=sample(x+step,z),c=sample(x+step,z+stepZ),d=sample(x,z+stepZ);
  if(cells===COARSE&&(i===0||j===0||i===cells-1||j===cells-1)){
   // Coarse borders consume the same 16 m samples as their fine neighbour.
   const ring=[a,...(j===0?[sample(x+step/2,z)]:[]),b,...(i===cells-1?[sample(x+step,z+stepZ/2)]:[]),c,...(j===cells-1?[sample(x+step/2,z+stepZ)]:[]),d,...(i===0?[sample(x,z+stepZ/2)]:[])],middle=sample(x+step/2,z+stepZ/2);for(let k=0;k<ring.length;k++)triangle(middle,ring[(k+1)%ring.length],ring[k]);
  }else {triangle(a,c,b);triangle(a,d,c);}
 }
 const floorTriangles=mesh.triangles.slice();if(clip){mesh.ground.rim=clip.finish();mesh.ground.solid=p=>clip.margin(p)>=0;}
 // Shared geographic normals; neither the LOD nor the owning chunk changes
 // lighting at a join. Geometry and collision still use the same triangles.
 for(let i=0;i<mesh.data.length;i+=11){const x=mesh.data[i],z=mesh.data[i+2],e=.001,n=M.norm([-(sample(x+e,z)[1]-sample(x-e,z)[1])/(2*e),1,-(sample(x,z+e)[1]-sample(x,z-e)[1])/(2*e)]);for(let k=0;k<3;k++)mesh.data[i+3+k]=n[k];}
 // Sparse props belong to fixed 128 m cells. A footprint crossing void is
 // rejected before it is emitted. No landing-centred clearing or random stream.
 const props=[];
 if(cells===FINE){
  // A fixed 3-D lattice gives each object one geographic owner even across
  // chart changes, poles, longitude wrap and a differently anchored revisit.
  const corners=[[loX,0,loZ],[loX+spanX,0,loZ],[loX,0,loZ+spanZ],[loX+spanX,0,loZ+spanZ]].map(p=>M.mul(M.norm(f.world(p)),s.radius)),pitch=.128,min=[0,1,2].map(i=>Math.floor(Math.min(...corners.map(p=>p[i]))/pitch)-1),max=[0,1,2].map(i=>Math.floor(Math.max(...corners.map(p=>p[i]))/pitch)+1),floor=S.packBVH(floorTriangles);
  for(let iz=min[2];iz<=max[2];iz++)for(let iy=min[1];iy<=max[1];iy++)for(let ix=min[0];ix<=max[0];ix++){
   const world=[(ix+.5)*pitch,(iy+.5)*pitch,(iz+.5)*pitch];if(Math.abs(M.length(world)-s.radius)>.055||S.noise(ix,iy,s.seed+iz)>.28)continue;
   const q=M.norm(world),local=f.local(M.mul(q,s.radius)),x=local[0],z=local[2];if(x<loX||x>=loX+spanX||z<loZ||z>=loZ+spanZ||root.SphereWatershed?.sample(q,s)||C.missing(q,s))continue;
   const id=W.sample(q,s).biome,r=.0025,h=.003+S.noise(ix,iz,s.seed+iy)*.004,hit={},distance=S.rayBVH([x,10,z],[0,-1,0],floor,Infinity,hit);if(!hit.normal)continue;
   if(clip&&[[x-r,0,z-r],[x+r,0,z-r],[x-r,0,z+r],[x+r,0,z+r]].some(p=>clip.margin(p)<0))continue;
   props.push([s.seed,ix,iy,iz].join(':'));
   // Object axes belong to its geographic point, not to the current chart.
   const axes=S.shellFrame(q).map(axis=>f.basis.map(b=>M.dot(axis,b))),base=[x,10-distance,z],vertex=(angle,radius,y)=>M.add(base,M.add(M.mul(axes[1],y),M.add(M.mul(axes[0],Math.cos(angle)*radius),M.mul(axes[2],Math.sin(angle)*radius))));
   for(let side=0;side<5;side++){const a=side*2*Math.PI/5,b=(side+1)*2*Math.PI/5;mesh.quad(vertex(a,r,0),vertex(b,r,0),vertex(b,r*.25,h),vertex(a,r*.25,h),W.palette[id]);}
  }
 }

 mesh.finish({deferBVH:true});mesh.bvh=S.packBVH(mesh.triangles);delete mesh.triangles;mesh.ground.floor=mesh.bvh;if(mesh.ground.rim)delete mesh.ground.rim.floor;delete mesh.ground.solid;mesh.ground.props=props;mesh.chunk={x:cx,z:cz,cells,revision:2};mesh.ground.rim&&(mesh.ground.rim.key=key(s)+':'+cx+':'+cz+':'+cells);return mesh;
}
function sizeOf(mesh){const tree=t=>t?.packedTriangles?t.packedTriangles.byteLength+t.nodes.byteLength:0,wall=mesh.ground.rim?.wall;return mesh.vertices.byteLength+tree(mesh.bvh)+(mesh.ground.floor===mesh.bvh?0:tree(mesh.ground.floor))+(wall?wall.vertices.byteLength+tree(wall.bvh):0);}
function trim(extra=0){for(const [k,entry]of cache){if(bytes+extra<=BUDGET)break;if(active?.wanted.has(k)||target?.wanted.has(k)||rebaseReady?.wanted.has(k))continue;bytes-=entry.size;cache.delete(k);}}
function retain(k,mesh){const size=sizeOf(mesh);trim(size);if(bytes+size>BUDGET)throw Error('Connected ground reservation exceeded');cache.set(k,{mesh,size});bytes+=size;return mesh;}
function request(s){if(!enabled(s))return;const b=bounds(s),id=key(s),signature=id+':'+b.x+':'+b.z;if(rebase&&!s.walkMode){rebase=null;rebaseReady=null;}if(rebase&&id===rebase.from)return;if(active?.signature===signature){if(target){target=null;pending=null;generation++;worker?.postMessage({generation,state:s,jobs:[]});}return;}if(target?.signature===signature)return;
 if(!s.walkMode&&(active?.id!==id||Math.max(Math.abs((active?.b.x||0)-b.x),Math.abs((active?.b.z||0)-b.z))>3))active=null;
 const wanted=new Set(),jobs=[];for(let z=b.z-2;z<=b.z+2;z++)for(let x=b.x-2;x<=b.x+2;x++){const cells=Math.max(Math.abs(x-b.x),Math.abs(z-b.z))<=1?FINE:COARSE,k=id+':'+x+':'+z+':'+cells+(cells===COARSE?':'+b.x+':'+b.z:'');wanted.add(k);if(!cache.has(k))jobs.push({key:k,x,z,cells,centre:[b.x,b.z]});}
 target={signature,id,wanted,b};generation++;pending=null;
 if(typeof Worker==='undefined'){for(const job of jobs)retain(job.key,build(s,job.x,job.z,job.cells,job.centre));promote();return;}
 if(!worker){worker=new Worker('ground-worker.js');worker.onmessage=({data})=>{if(data.generation!==generation)return;if(data.error){target.error=data.error;return;}trim(sizeOf(data.mesh));if(bytes+sizeOf(data.mesh)>BUDGET){target.error='Connected ground reservation exceeded';return;}pending=data;};worker.onerror=e=>{if(target)target.error=e.message;};}
 worker.postMessage({generation,state:s,jobs:jobs.sort((a,c)=>Math.hypot(a.x-b.x,a.z-b.z)-Math.hypot(c.x-b.x,c.z-b.z))});promote();
}
function promote(){if(target&&[...target.wanted].every(k=>cache.has(k))){const result={...target,groups:[...target.wanted].map(k=>cache.get(k).mesh)};if(rebase&&target.id===rebase.to)rebaseReady=result;else active=result;target=null;revision++;}}
function rebaseWalking(s){if(!enabled(s)||!s.walkMode)return;
 if(rebaseReady&&key(s)===rebase.from){s.terrainAnchor=rebase.anchor;s.walkPosition=frame(s).local(s.position);active=rebaseReady;rebaseReady=null;rebase=null;revision++;return;}
 if(rebase||Math.max(Math.abs(s.walkPosition[0]),Math.abs(s.walkPosition[2]))<7)return;
 const anchor=M.norm(s.position),next={...s,terrainAnchor:anchor};rebase={from:key(s),to:key(next),anchor};request(next);
}
function pump(upload){if(!pending)return;const packet=pending;if(packet.generation!==generation){pending=null;return;}const mesh=packet.hydrated||(packet.hydrated=Object.assign(Object.create(S.Mesh.prototype),packet.mesh));if(mesh.ground.rim?.wall&&!mesh.ground.rim.wall.world)Object.setPrototypeOf(mesh.ground.rim.wall,S.Mesh.prototype);
 if(!upload(mesh))return;if(mesh.ground.rim?.wall&&!upload(mesh.ground.rim.wall))return;retain(packet.key,mesh);buildMs=packet.buildMs;pending=null;promote();worker.postMessage({generation,next:true});
}
function neighbourhood(s){if(!enabled(s))return [];request(s);if(target?.error)throw Error(target.error);return active?.id===key(s)?active.groups:[];
}
function rimCut(s){const groups=neighbourhood(s),rims=groups.map(m=>m.ground.rim).filter(Boolean);if(!rims.length)return null;const index=rims[0].index,intervals=rims.flatMap(r=>r.cuts).sort((a,b)=>a[0]-b[0]),cuts=[];
 for(const [a,b]of intervals){if(cuts.length&&a<=cuts.at(-1)[1]+1e-12)cuts.at(-1)[1]=Math.max(cuts.at(-1)[1],b);else cuts.push([a,b]);}
 const ends=[];for(const t of cuts.flat()){if(t===0||t===Math.PI*2)continue;let nearest=null;for(const rim of rims)for(const end of rim.ends)if(!nearest||Math.abs(end.t-t)<Math.abs(nearest.t-t))nearest=end;if(nearest)ends.push(nearest);}
 return {key:active.signature,index,cuts,ends,origin:groups[0].origin,basis:groups[0].basis};
}
function geometry(s){const groups=neighbourhood(s);return groups.flatMap(m=>m.ground.rim?[m,m.ground.rim.wall]:m.count?[m]:[]);}
function ground(s,x,z){const [cx,cz]=owner(x,z),mesh=neighbourhood(s).find(m=>x>=m.ground.bounds[0]&&x<m.ground.bounds[2]&&z>=m.ground.bounds[1]&&z<m.ground.bounds[3]);if(!mesh)return -Infinity;const hit={},t=S.rayBVH([x,10,z],[0,-1,0],mesh.ground.floor,Infinity,hit);return hit.normal?10-t:-Infinity;}
function controller(s){const f=frame(s);f.ground={connected:true,sample:(x,z)=>ground(s,x,z)};return f;}
function dispose(){worker?.terminate();worker=null;pending=null;active=null;target=null;rebase=null;rebaseReady=null;cache.clear();bytes=0;waits=0;generation++;revision++;}
root.SphereGround={dispose,enabled,frame,geographic,height,owner,build,neighbourhood,geometry,rimCut,ground,controller,request,pump,rebaseWalking,available(s){if(!enabled(s))return false;request(s);const p=frame(s).local(s.position);return active?.id===key(s)&&active.groups.some(m=>m.chunk.cells===FINE&&p[0]>=m.ground.bounds[0]&&p[0]<m.ground.bounds[2]&&p[2]>=m.ground.bounds[1]&&p[2]<m.ground.bounds[3]);},SIZE,FINE,COARSE,support(s,x,z){request(s);const ok=active?.id===key(s)&&active.groups.some(m=>m.chunk.cells===FINE&&x>=m.ground.bounds[0]&&x<m.ground.bounds[2]&&z>=m.ground.bounds[1]&&z<m.ground.bounds[3]);if(!ok)waits++;return ok;},ready(s){if(rebase&&key(s)===rebase.from){if(!rebaseReady)return false;rebaseWalking(s);}request(s);return active?.signature===key(s)+':'+bounds(s).x+':'+bounds(s).z;},has(mesh){return [...cache.values()].some(e=>e.mesh===mesh||e.mesh.ground.rim?.wall===mesh)||pending?.hydrated===mesh||pending?.hydrated?.ground.rim?.wall===mesh;},get revision(){return revision;},get needsFrame(){return !!target;},get info(){return {chunks:active?.groups.length||0,cache:cache.size,bytes:bytes+(pending?.mesh?sizeOf(pending.mesh):0),pendingBytes:pending?.mesh?sizeOf(pending.mesh):0,budget:BUDGET,buildMs,queue:target?[...target.wanted].filter(k=>!cache.has(k)).length:0,waits};}};
})(typeof window==='undefined'?globalThis:window);
