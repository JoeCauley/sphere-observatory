/* Watershed province revision 1. A bounded, deterministic addition to layout 2.
 * World addresses, catchments, rendered triangles and collision share kilometres.
 * The original biome, water, service function and attack damage remain separate.
 */
(function(root){
'use strict';
const M=root.SphereMath,W=root.SphereWorld,C=root.SphereCollection,S=root.SphereSites,N=root.SphereWatershedNetwork;
const EXTENT=640,cache=new Map(),models=new Map(),mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
const keyFor=s=>JSON.stringify([s.provinceRevision,s.provinceSeed,s.provinceAnchor,s.radius,s.era,s.multipleWounds]);
const pending=new Map();
function retain(key,groups){cache.set(key,groups);while(cache.size>2)cache.delete(cache.keys().next().value);return groups;}
async function prepare(s){
 if(!enabled(s))return [];
 const key=keyFor(s);if(cache.has(key))return cache.get(key);if(pending.has(key))return pending.get(key);
 if(typeof Worker==='undefined')return geometry(s);
 const job=new Promise((resolve,reject)=>{const worker=new Worker('watershed-worker.js');const timer=setTimeout(()=>{worker.terminate();reject(Error('The Watershed did not finish preparing. Please retry.'));},120000);
  worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();if(data.error){reject(Error(data.error));return;}resolve(retain(key,data.groups.map(g=>Object.assign(Object.create(S.Mesh.prototype),g))));};
  worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};worker.postMessage(s);
 });pending.set(key,job);try{return await job;}finally{pending.delete(key);}
}
function model(seed=713){
 if(models.has(seed))return models.get(seed);
 const graph=N.province(seed),n=graph.n,step=EXTENT/(n-1),segments=[],buckets=new Map(),caps=new Map();
 const taper=(x,z)=>1-W.smooth(280,320,Math.max(Math.abs(x),Math.abs(z)));
 function grid(values,x,z){const u=M.clamp((x+320)/step,0,n-1-1e-9),v=M.clamp((z+320)/step,0,n-1-1e-9),ix=Math.floor(u),iz=Math.floor(v),a=values[iz*n+ix],b=values[iz*n+ix+1],c=values[(iz+1)*n+ix+1],d=values[(iz+1)*n+ix],fx=u-ix,fz=v-iz;return fx>=fz?a+(b-a)*fx+(c-b)*fz:a+(c-d)*fx+(d-a)*fz;}
 const height=(x,z)=>Math.max(0,grid(graph.height,x,z)*1.8)*taper(x,z);
 const level=(x,z)=>Math.max(0,grid(graph.filled,x,z)*1.8)*taper(x,z);
 // Corner cutting removes the flood raster's diagonal stairs. Junction endpoints
 // stay fixed, so tributaries still meet their receiving river at one address.
 for(const path of graph.riverPaths){let p=path.points.map(([u,v])=>[u*EXTENT-320,v*EXTENT-320]);for(let pass=0;pass<2;pass++){const q=[p[0]];for(let j=1;j<p.length;j++){q.push(mix(p[j-1],p[j],.25),mix(p[j-1],p[j],.75));}q.push(p[p.length-1]);p=q;}
  const width=.12+Math.sqrt(path.flow)*.009;
  const distances=[0];for(let j=1;j<p.length;j++)distances.push(distances[j-1]+Math.hypot(p[j][0]-p[j-1][0],p[j][1]-p[j-1][1]));const total=distances.at(-1);
  p=p.map((v,j)=>{if(!j||j===p.length-1)return v;const before=p[j-1],after=p[j+1],dx=after[0]-before[0],dz=after[1]-before[1],len=Math.hypot(dx,dz)||1,t=distances[j],bend=Math.sin(Math.PI*t/total)**2*Math.min(3.5,width*4)*(.75*Math.sin(t*.12+seed)+.25*Math.sin(t*.31));return [v[0]-dz/len*bend,v[1]+dx/len*bend];});
  // Both neighboring quads use the very same banks at a bend. Independent
  // segment normals leave triangular dry wedges between otherwise joined rivers.
  const banks=p.map((v,j)=>{const a=p[Math.max(0,j-1)],b=p[Math.min(p.length-1,j+1)],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1,edge=p[Math.min(p.length-1,j+1)],ex=edge[0]-v[0],ez=edge[1]-v[1],el=Math.hypot(ex,ez)||1,miter=j===p.length-1?1:Math.min(1.8,1/Math.max(.55,(dx*ex+dz*ez)/len/el)),r=width*miter;return [[v[0]-dz/len*r,v[1]+dx/len*r],[v[0]+dz/len*r,v[1]-dx/len*r]];});
  for(const v of [p[0],p.at(-1)]){const key=v.join(':');if(!caps.has(key)||caps.get(key).width<width)caps.set(key,{point:v,width});}
  for(let j=1;j<p.length;j++){const a=p[j-1],b=p[j],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<1e-8)continue;const seg={a,b,banks:[...banks[j-1],...banks[j]],width,flow:path.flow,length};segments.push(seg);
   for(let z=Math.floor((Math.min(a[1],b[1])-width)/16);z<=Math.floor((Math.max(a[1],b[1])+width)/16);z++)for(let x=Math.floor((Math.min(a[0],b[0])-width)/16);x<=Math.floor((Math.max(a[0],b[0])+width)/16);x++){const key=x+':'+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(seg);}
  }
 }
 function water(x,z){let distance=Infinity,river=null;for(const seg of buckets.get(Math.floor(x/16)+':'+Math.floor(z/16))||[]){const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1],t=M.clamp(((x-seg.a[0])*dx+(z-seg.a[1])*dz)/(seg.length*seg.length),0,1),d=Math.hypot(x-seg.a[0]-t*dx,z-seg.a[1]-t*dz)-seg.width;if(d<distance){distance=d;river=seg;}}
  return {river:distance<=0,basin:level(x,z)-height(x,z)>.006,distance,flow:river?.flow||0};
 }
 const stations=[];
 for(const source of graph.sites){const x=source.u*EXTENT-320,z=source.v*EXTENT-320;let nearest=null,distance=Infinity;for(const seg of segments){const d=Math.hypot(seg.a[0]-x,seg.a[1]-z);if(d<distance&&Math.max(...seg.a.map(Math.abs))<260){distance=d;nearest=seg;}}if(!nearest)continue;
  const dx=(nearest.b[0]-nearest.a[0])/nearest.length,dz=(nearest.b[1]-nearest.a[1])/nearest.length;
  for(const side of [1,-1]){const offset=nearest.width+1.1,point=[nearest.a[0]-dz*offset*side,nearest.a[1]+dx*offset*side];if(water(...point).river||water(...point).basin)continue;stations.push({x:point[0],z:point[1],angle:Math.atan2(dz,dx),role:source.role,river:nearest});break;}
 }
 const focus=stations.find(p=>Math.abs(p.x)<160&&Math.abs(p.z)<160)||stations[0];let role=0;
 for(const station of stations)station.role=station===focus?'Water recovery':['Reserve storage','Fabrication','Thermal transfer','Water recovery'][role++%4];
 const result={seed,graph,n,step,height,level,water,segments,caps:[...caps.values()],stations,focus,taper};models.set(seed,result);while(models.size>2)models.delete(models.keys().next().value);return result;
}
function enabled(s){return s.provinceRevision===1&&s.layoutVersion===2&&s.collection&&!!s.provinceAnchor;}
function frame(s){const q=s.provinceAnchor;return {origin:M.mul(q,s.radius),basis:S.shellFrame(q)};}
function local(q,s){const f=frame(s),den=M.dot(q,s.provinceAnchor);if(den<=0)return [Infinity,Infinity];return [M.dot(q,f.basis[0])*s.radius/den,M.dot(q,f.basis[2])*s.radius/den];}
function direction(x,z,s){const f=frame(s);return M.norm(M.add(s.provinceAnchor,M.add(M.mul(f.basis[0],x/s.radius),M.mul(f.basis[2],z/s.radius))));}
function sample(q,s){if(!enabled(s))return null;const [x,z]=local(q,s);if(Math.max(Math.abs(x),Math.abs(z))>=320)return null;const p=model(s.provinceSeed),original=W.sample(q,s),water=p.water(x,z);return {revision:1,seed:s.provinceSeed,x,z,originalBiome:original.id,terrainKm:p.height(x,z),water,service:p.stations.find(v=>Math.hypot(v.x-x,v.z-z)<1)?.role||null,damage:original.damage,missing:C.missing(q,s)};}
function geometry(s){
 if(!enabled(s))return [];
 const key=keyFor(s);
 if(cache.has(key))return cache.get(key);
 const p=model(s.provinceSeed),f=frame(s),mesh=new S.Mesh(f.origin,f.basis,'Watershed · land and water');
 // Curvature is evaluated in doubles before entering camera-relative buffers.
 const point=(x,z,h)=>mesh.local(M.mul(direction(x,z,s),s.radius-h));
 const landColor=()=>[.055,.10,.029];
 function tri(a,b,c,color,material){if([a,b,c].some(v=>C.missing(M.norm(mesh.world(v)),s)))return;mesh.tri(a,c,b,color,material);}
 for(let z=0;z<p.n-1;z++)for(let x=0;x<p.n-1;x++){
  const xx=x*p.step-320,zz=z*p.step-320,coords=[[xx,zz],[xx+p.step,zz],[xx+p.step,zz+p.step],[xx,zz+p.step]],points=coords.map(([x,z])=>point(x,z,p.height(x,z))),q=direction(xx+p.step*.5,zz+p.step*.5,s),damage=W.sample(q,s).damage,col=mix(landColor(xx,zz),W.woundPalette[W.edgeBiome(W.sample(q,s).id)],damage);
  tri(points[0],points[1],points[2],col,-5);tri(points[0],points[2],points[3],col,-5);
  // Clip each basin triangle at its actual shoreline, instead of painting a
  // whole flood-grid cell blue. Land and water interpolate the same elevations.
  const depths=coords.map(([x,z])=>p.level(x,z)-p.height(x,z)-.006);
  for(const indices of [[0,1,2],[0,2,3]]){let polygon=[];for(let j=0;j<3;j++){const i=indices[j],k=indices[(j+1)%3],a=coords[i],b=coords[k],da=depths[i],db=depths[k];if(da>0)polygon.push(a);if((da>0)!==(db>0))polygon.push(mix(a,b,da/(da-db)));}if(polygon.length<3)continue;const water=polygon.map(([x,z])=>point(x,z,p.level(x,z)+.002));for(let j=1;j<water.length-1;j++)tri(water[0],water[j],water[j+1],[.012,.10,.10],-6);}

 }
 for(const seg of p.segments){const positions=seg.banks.map(([x,z],i)=>point(x,z,Math.max(p.height(x,z),p.level(...(i<2?seg.a:seg.b)))+.004));tri(positions[0],positions[1],positions[3],[.016,.105,.115],-6);tri(positions[0],positions[3],positions[2],[.016,.105,.115],-6);}
 for(const cap of p.caps){const [x,z]=cap.point;if(Math.max(Math.abs(x),Math.abs(z))>315)continue;const level=p.level(x,z)+.004,centre=point(x,z,Math.max(p.height(x,z)+.004,level)),ring=Array.from({length:24},(_,i)=>{const a=i*Math.PI/12,xx=x+Math.cos(a)*cap.width,zz=z+Math.sin(a)*cap.width;return point(xx,zz,Math.max(p.height(xx,zz)+.004,level));});for(let i=0;i<24;i++)tri(centre,ring[i],ring[(i+1)%24],[.016,.105,.115],-6);}
 mesh.finish({deferBVH:true});const groups=[mesh];
 for(const station of p.stations){const q=direction(station.x,station.z,s);if(C.missing(q,s)||W.sample(q,s).damage>.3)continue;groups.push(garden(s,p,station));}
 return retain(key,groups);
}
function garden(s,p,station){
 const q=direction(station.x,station.z,s),mesh=new S.Mesh(M.mul(q,s.radius),S.shellFrame(q),'Watershed · '+station.role),angle=station.angle,c=Math.cos(angle),sn=Math.sin(angle);
 const toProvince=(x,z)=>[station.x+c*x-sn*z,station.z+sn*x+c*z];
 const ground=(x,z)=>p.height(...toProvince(x,z));
 // Ivory crescents and copper ribs sit among planted courts. The open centre
 // preserves a view to the river; no repeated rectangular factory parcels.
 const stone=[.38,.34,.25],copper=[.18,.095,.048],leaf=[.055,.115,.041];
 const platform=Math.max(...Array.from({length:48},(_,i)=>ground(Math.cos(i)*.38,Math.sin(i)*.38)))+.008;
 function ring(inner,outer,start,end,y,depth,color){const steps=Math.ceil((end-start)*20);for(let i=0;i<steps;i++){const a=start+(end-start)*i/steps,b=start+(end-start)*(i+1)/steps,pt=(r,t,h)=>[Math.cos(t)*r,h,Math.sin(t)*r];mesh.quad(pt(inner,a,y),pt(inner,b,y),pt(outer,b,y),pt(outer,a,y),color,-7);mesh.quad(pt(outer,a,y-depth),pt(outer,b,y-depth),pt(outer,b,y),pt(outer,a,y),color.map(v=>v*.7),-7);mesh.quad(pt(inner,b,y-depth),pt(inner,a,y-depth),pt(inner,a,y),pt(inner,b,y),color.map(v=>v*.8),-7);}}
 // Basal terraces are solid down to the landscape, including their inner faces.
 for(let j=0;j<3;j++)ring(.15+j*.075,.22+j*.075,.18,Math.PI*1.73,platform+j*.009,.10,stone.map(v=>v*(.85+j*.08)));
 ring(.225,.285,.30,Math.PI*1.65,platform+.066,.007,stone);
 for(let i=0;i<37;i++){const a=.33+i*(Math.PI*1.3/36),r=.254,x=Math.cos(a)*r,z=Math.sin(a)*r;mesh.beam([x,platform+.014,z],[x*.95,platform+.063,z*.95],.003,copper);}
 // A still recovery pool frames the planted island. Water has its own finish.
 const waterY=platform+.003;for(let j=0;j<80;j++){const a=j*Math.PI*2/80,b=(j+1)*Math.PI*2/80;mesh.tri([0,waterY,0],[Math.cos(a)*.142,waterY,Math.sin(a)*.142],[Math.cos(b)*.142,waterY,Math.sin(b)*.142],[.012,.10,.105],-6);}
 mesh.cone([0,platform-.012,0],.062,.019,leaf,48,.058);for(let j=0;j<64;j++){const a=j*Math.PI/32,b=(j+1)*Math.PI/32;mesh.tri([0,platform+.007,0],[Math.cos(a)*.058,platform+.007,Math.sin(a)*.058],[Math.cos(b)*.058,platform+.007,Math.sin(b)*.058],leaf);}
 function crown(x,y,z,r,h,color){const rings=4,sides=9,pt=(i,j)=>{const lat=-Math.PI/2+i*Math.PI/rings,a=j*Math.PI*2/sides;return [x+Math.cos(lat)*Math.cos(a)*r,y+Math.sin(lat)*h,z+Math.cos(lat)*Math.sin(a)*r];};for(let i=0;i<rings;i++)for(let j=0;j<sides;j++)mesh.quad(pt(i,j),pt(i,j+1),pt(i+1,j+1),pt(i+1,j),color);}
 // The island's shelter tree is a living focal point, lifted above the pool.
 mesh.cone([0,platform+.007,0],.004,.034,copper,9,.002);for(let i=0;i<7;i++){const a=i*2.4,x=Math.cos(a)*.030,z=Math.sin(a)*.030;mesh.beam([0,platform+.027,0],[x,platform+.050,z],.002,copper);crown(x,platform+.054,z,.023,.012,mix(leaf,[.18,.21,.07],i/9));}
 // Human-scale groves, benches and a continuous promenade establish scale.
 for(let i=0;i<480;i++){const a=i*2.3999632297,r=.41+.44*Math.sqrt(N.noise(i*3.17,7,s.provinceSeed)),x=Math.cos(a)*r,z=Math.sin(a)*r,[px,pz]=toProvince(x,z),water=p.water(px,pz);if(water.river||water.basin)continue;const y=ground(x,z),h=.010+.020*N.noise(i*2.1,11,s.provinceSeed);mesh.cone([x,y,z],.001,h*.60,copper,5,.0006);crown(x,y+h*.83,z,h*.42,h*.32,mix(leaf,[.16,.19,.06],N.noise(i,3,s.provinceSeed)));}
 for(let i=0;i<18;i++){const a=.4+i*.25,x=Math.cos(a)*.19,z=Math.sin(a)*.19;mesh.box([x,platform+.000225,z],[.0024,.00045,.0007],copper,a);}
 // The shared architectural language does not erase the facility's job.
 if(station.role==='Thermal transfer')for(let i=0;i<30;i++){const a=.5+i*.11,r=.34;mesh.box([Math.cos(a)*r,platform+.035,Math.sin(a)*r],[.003,.045,.030],copper,a);}
 if(station.role==='Reserve storage')for(let i=0;i<5;i++){const a=.5+i*.8,x=Math.cos(a)*.34,z=Math.sin(a)*.34;mesh.cone([x,platform+.025,z],.026,.008,stone,32,.026);for(let j=0;j<32;j++){const b=j*Math.PI/16,d=(j+1)*Math.PI/16;mesh.tri([x,platform+.033,z],[x+Math.cos(b)*.026,platform+.033,z+Math.sin(b)*.026],[x+Math.cos(d)*.026,platform+.033,z+Math.sin(d)*.026],stone,-7);}}
 if(station.role==='Fabrication')for(let i=0;i<3;i++){const a=.8+i*.65,x=Math.cos(a)*.33,z=Math.sin(a)*.33;for(let j=0;j<14;j++){const t=j*Math.PI/13;mesh.beam([x-.028,platform+.028+Math.sin(t)*.018,z+Math.cos(t)*.022],[x+.028,platform+.028+Math.sin(t)*.018,z+Math.cos(t)*.022],.002,copper);}}
 // Observation terrace is the saved ground arrival, six metres above its floor.
 mesh.box([.33,platform+.01,0],[.09,.02,.065],stone);
 mesh.arrivalLocal=[.35,platform+.026,0];mesh.lookLocal=[-.02,platform+.003,0];mesh.station=[station.x,station.z];
 // Rotate district coordinates into the common province tangent frame. At this
 // scale its spherical correction is below a millimetre at the default radius.
 const base=mesh.basis;mesh.basis=[M.add(M.mul(base[0],c),M.mul(base[2],sn)),base[1],M.add(M.mul(base[0],-sn),M.mul(base[2],c))];
 return mesh.finish({deferBVH:true});
}
function activate(s){const result={...s,layoutVersion:2,collection:true,provinceRevision:1,provinceSeed:s.provinceSeed??713,provinceAnchor:s.provinceAnchor||W.locateBiome(0,{...s,layoutVersion:2,collection:true})};const clean=M.validate(result);clean.playing=!!s.playing;return clean;}
function view(input,name='approach'){
 const s=activate(input),p=model(s.provinceSeed),station=p.focus,groups=geometry(s),district=groups.find(m=>m.station?.[0]===station.x&&m.station?.[1]===station.z)||groups[1];
 Object.assign(s,{siteId:'',siteAnchor:null,siteRevision:0,siteElevation:0,walkSurface:false,walkMode:false,walkPosition:null,shadeAttachment:null,geometryDetail:true,biome:-1,projection:'perspective',speed:1,surfaceLock:false});
 if(name==='terrace'){s.position=district.world(district.arrivalLocal);s.forward=M.norm(M.sub(district.world(district.lookLocal),s.position));s.up=district.basis[1];s.speed=.002;}
 else if(name==='garden'){s.position=district.world([.82,p.height(station.x,station.z)+1,.9]);s.forward=M.norm(M.sub(district.world([0,p.height(station.x,station.z),0]),s.position));s.up=district.basis[1];s.speed=.02;}
 else {const regional=['province','region','neighbourhood'].includes(name),focus=regional?[0,0]:[station.x,station.z],altitude=name==='neighbourhood'?40000:name==='region'?10000:name==='province'?1100:48,offset=regional?80:32,target=M.mul(direction(...focus,s),s.radius-p.height(...focus));s.position=M.mul(direction(focus[0],focus[1]+offset,s),s.radius-altitude);s.forward=M.norm(M.sub(target,s.position));s.up=M.mul(s.provinceAnchor,-1);s.speed=name==='province'?100:5;}
 s.up=M.basis(s.forward,s.up).u;const clean=M.validate(s);clean.playing=!!input.playing;return clean;
}
function visible(s){return enabled(s)&&M.length(M.sub(s.position,M.mul(s.provinceAnchor,s.radius)))<2000000;}
root.SphereWatershed={enabled,visible,ready:s=>!enabled(s)||cache.has(keyFor(s)),model,frame,local,direction,sample,geometry,prepare,activate,view,extentKm:EXTENT,revision:1,
 has(mesh){return [...cache.values()].some(groups=>groups.includes(mesh));},
 get info(){const groups=[...cache.values()].flat();return {provinces:cache.size,pending:pending.size,meshes:groups.length,triangles:groups.reduce((n,m)=>n+m.count/3,0),vertexMiB:groups.reduce((n,m)=>n+m.vertices.byteLength,0)/1048576,packedCollisionMiB:groups.reduce((n,m)=>n+(m.bvh.packedTriangles?.byteLength||0)+(m.bvh.nodes?.byteLength||0),0)/1048576};}};
})(typeof window==='undefined'?globalThis:window);
