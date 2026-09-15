/* Revision 1: one continuous drainage/route graph around the unchanged garden.
 * Broad land and waterways are analytic shell materials, not displaced terrain.
 * Their CPU masks and GPU data share these saved, kilometre-scaled coordinates.
 */
(function(root){
'use strict';const M=root.SphereMath,P=root.SphereWatershed,N=root.SphereWatershedNetwork,cache=new Map();
function model(seed=713){
 if(cache.has(seed))return cache.get(seed);
 const core=P.model(seed),edges=[],nodes=[],junctions=[];
 function node(x,z,width){const n={id:nodes.length,x,z,width};nodes.push(n);return n;}
 function edge(a,b){edges.push({a:[a.x,a.z],b:[b.x,b.z],widthA:a.width,widthB:b.width,from:a.id,to:b.id});}
 function chain(points){for(let i=1;i<points.length;i++)edge(points[i-1],points[i]);}
 const gates=[node(950,0,3),node(0,-1300,3),node(-1100,0,3),node(-80,1150,3)];
 const outlets=core.segments.filter(e=>Math.max(...e.b.map(Math.abs))>=319.999);
 // Every original outlet is retained byte-for-byte. Four unequal receiving
 // reaches collect their flow outside the protected 640 km core.
 for(const old of outlets){const [x,z]=old.b,side=x>=319.99?0:z<=-319.99?1:x<=-319.99?2:3,g=gates[side],a=node(x,z,old.width),b=node(x*(side%2===0?1.8:1)+g.x*.08+(N.noise(x,z,seed)-.5)*80,z*(side%2?1.8:1)+g.z*.08+(N.noise(z,x,seed)-.5)*100,(old.width+g.width)*.45);a.tangent=[(old.b[0]-old.a[0])/old.length,(old.b[1]-old.a[1])/old.length];chain([a,b,g]);junctions.push({source:old.b,sourceWidth:old.width,node:a.id,gate:g.id,flow:old.flow});}
 const join=node(3500,2800,12),mid=node(9200,5900,58),lower=node(17500,2200,140),lake=node(29400,8800,310),out=node(48000,2200,460);
 chain([gates[0],node(1800,1000,6),join]);chain([gates[1],node(1300,-2300,5),node(4500,-800,8),join]);chain([gates[2],node(-2100,2400,5),node(-700,4100,8),join]);chain([gates[3],node(1300,2300,6),join]);chain([join,mid,lower,lake,out]);
 const catchments=[[-33500,-23000,15000,mid],[-18500,21500,12000,join],[4000,-33500,18000,lower],[21500,33500,15500,lake],[38000,-24000,17500,out],[-35000,6500,11000,join]];
 for(let i=0;i<catchments.length;i++){const [x,z,r,target]=catchments[i],j=(N.noise(i*3,7,seed)-.5)*2400,a=node(x+j,z-j,target.width*.10),b=node(x*.70+target.x*.30+(i%2?1800:-2700),z*.70+target.z*.30,target.width*.40),c=node(x*.32+target.x*.68,z*.32+target.z*.68+(i%2?-2100:2700),target.width*.75);chain([a,b,c,target]);}
 if(edges.length>128)throw Error('Watershed graph exceeds its pack budget');
 // Shared junction tangents round the receiving reaches without disconnecting
 // a single endpoint. The original outlet direction is the boundary condition.
 const unit=(x,z)=>{const l=Math.hypot(x,z)||1;return [x/l,z/l];};
 for(const n of nodes){if(n.tangent)continue;const outgoing=edges.find(e=>e.from===n.id),incoming=edges.filter(e=>e.to===n.id).sort((a,b)=>b.widthA-a.widthA)[0],a=outgoing?unit(outgoing.b[0]-n.x,outgoing.b[1]-n.z):null,b=incoming?unit(n.x-incoming.a[0],n.z-incoming.a[1]):null;n.tangent=a&&b?unit(a[0]+b[0],a[1]+b[1]):a||b||[1,0];}
 for(const e of edges){const a=nodes[e.from],b=nodes[e.to],l=Math.hypot(b.x-a.x,b.z-a.z)*.32;e.c1=[a.x+a.tangent[0]*l,a.z+a.tangent[1]*l];e.c2=[b.x-b.tangent[0]*l,b.z-b.tangent[1]*l];e.points=Array.from({length:13},(_,i)=>{const t=i/12,u=1-t;return [u*u*u*a.x+3*u*u*t*e.c1[0]+3*u*t*t*e.c2[0]+t*t*t*b.x,u*u*u*a.z+3*u*u*t*e.c1[1]+3*u*t*t*e.c2[1]+t*t*t*b.z];});}
 // Art 2 uses overlapping, river-oriented districts, never independently
 // rotated water or terrain tiles. The graph and revision-1 core stay exact.
 const compositions=[
  {id:'lake',x:lake.x,z:lake.z,rx:10500,rz:7200,axis:lake.tangent.slice(),bank:[29400,10100]},
  {id:'reach',x:lower.x,z:lower.z,rx:12000,rz:6500,axis:lower.tangent.slice(),bank:[17500,2600]},
  {id:'meadow',x:21500,z:-5000,rx:12500,rz:8500,axis:lower.tangent.slice(),bank:[21500,-5000]}
 ];
 const result={seed,edges,nodes,junctions,compositions,catchments:catchments.map(([x,z,r],i)=>({x,z,r,id:i})),lake:{x:lake.x,z:lake.z,rx:2100,rz:1100},core};cache.set(seed,result);while(cache.size>2)cache.delete(cache.keys().next().value);return result;
}
const smooth=(a,b,x)=>{const t=M.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function mask(x,z){const a=Math.atan2(z,x),r=Math.hypot(x,z)/(1+.13*Math.sin(a*3+.4)+.07*Math.sin(a*7-1));return 1-smooth(49000,65000,r);}
function compositionWeights(x,z,seed=713){
 const weights=model(seed).compositions.map(c=>{const dx=x-c.x,dz=z-c.z,u=dx*c.axis[0]+dz*c.axis[1],v=-dx*c.axis[1]+dz*c.axis[0];return (1-smooth(.55,1,Math.hypot(u/c.rx,v/c.rz)))*smooth(1600,2400,Math.hypot(x,z));});
 const total=weights.reduce((a,b)=>a+b,0);return weights.map(w=>w/Math.max(1,total));
}
function view(input,id){
 const s=root.SpherePacks.activate(input),c=model(s.provinceSeed).compositions.find(c=>c.id===id);if(!c)throw Error('Unknown Watershed composition');
 s.packAddress.artRevision=2;
 Object.assign(s,{siteId:'',siteAnchor:null,siteRevision:0,siteElevation:0,walkSurface:false,walkMode:false,walkPosition:null,shadeAttachment:null,geometryDetail:true,biome:-1,projection:'perspective',surfaceLock:false});
 s.position=M.mul(P.direction(c.x-2800,c.z+4500,s),s.radius-9000);s.forward=M.norm(M.sub(M.mul(P.direction(c.x,c.z,s),s.radius),s.position));s.up=M.basis(s.forward,M.mul(s.provinceAnchor,-1)).u;
 const clean=M.validate(s);clean.playing=!!input.playing;return clean;
}
function sampleLocal(x,z,seed=713){
 const coverage=mask(x,z);if(!coverage)return null;const p=model(seed);let distance=Infinity,routeDistance=Infinity,nearest=null,t=0;
 for(const e of p.edges)for(let i=1;i<e.points.length;i++){const a=e.points[i-1],b=e.points[i],dx=b[0]-a[0],dz=b[1]-a[1],v=M.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1),u=(i-1+v)/12,w=e.widthA*(1-u)+e.widthB*u,d=Math.hypot(x-a[0]-v*dx,z-a[1]-v*dz);if(d-w<distance){distance=d-w;nearest=e;t=u;}routeDistance=Math.min(routeDistance,Math.abs(d-w-Math.max(.08,w*.16))-Math.max(.012,w*.015));}
 const lake=p.lake,basin=Math.hypot((x-lake.x)/lake.rx,(z-lake.z)/lake.rz)<1;
 let catchment=0,best=Infinity;for(const c of p.catchments){const d=Math.hypot(x-c.x,z-c.z)/c.r;if(d<best){best=d;catchment=c.id;}}
 return {coverage,river:distance<=0,basin,water:distance<=0||basin,distance,route:routeDistance<=0,routeDistance,catchment,edge:nearest?{from:nearest.from,to:nearest.to,t}:null,terrainKm:0};
}
function sample(q,s){if(!root.SpherePacks.enabled(s))return null;const [x,z]=P.local(q,s);if(!Number.isFinite(x))return null;const v=sampleLocal(x,z,s.provinceSeed);return v?{...v,x,z,revision:1,seed:s.provinceSeed,...(s.packAddress.artRevision===2?{compositionWeights:compositionWeights(x,z,s.provinceSeed)}:{})}:null;}
root.SphereNeighbourhood={model,mask,view,compositionWeights,sampleLocal,sample,get info(){return {addresses:cache.size,segments:[...cache.values()].reduce((n,p)=>n+p.edges.length,0),graphBytes:[...cache.values()].reduce((n,p)=>n+p.edges.length*272+p.nodes.length*48+p.compositions.length*8*8,0),textureBytes:0};}};
const originalSample=P.sample;
P.sample=(q,s)=>{const original=originalSample(q,s);if(original)return original;const v=sample(q,s);if(!v)return null;const region=root.SphereWorld.sample(q,s);return {revision:1,seed:s.provinceSeed,x:v.x,z:v.z,originalBiome:region.id,terrainKm:0,water:{river:v.river,basin:v.basin,distance:v.distance},route:v.route,service:null,damage:region.damage,missing:root.SphereCollection.missing(q,s)};};
})(typeof window==='undefined'?globalThis:window);
