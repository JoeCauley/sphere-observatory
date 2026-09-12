/* Collection study v1. Prescribed engineering, not an orbital simulation. */
(function(root){
'use strict';const M=root.SphereMath,TAU=2*Math.PI;
const routes=[
 {name:'Verdant belt',normal:[0,1,0],radius:.62,count:8,hours:24,width:.155,sectors:24,phase:0},
 {name:'Opaline belt',normal:M.norm([.48,.84,.25]),radius:.74,count:6,hours:36,width:.12,sectors:18,phase:.33},
 {name:'Amber belt',normal:M.norm([-.55,.65,.52]),radius:.86,count:4,hours:60,width:.09,sectors:12,phase:.71}
];
for(const r of routes){r.right=M.norm(M.cross(r.normal,[0,0,1]));r.up=M.cross(r.normal,r.right);}
const palette=[[.015,.12,.065],[.02,.15,.18],[.115,.04,.15],[.22,.10,.025],[.16,.045,.055],[.23,.28,.16],[.025,.065,.18],[.13,.20,.21]];
const woundSpecs=[[12,-12,.32,.035,24],[-25,61,.43,.044,-32],[39,132,.27,.026,60],[-48,-115,.38,.055,12],[23,-156,.22,.027,-50],[60,5,.20,.02,38]];
const wounds=woundSpecs.map(([lat,lon,length,width,turn])=>{const axis=M.axis(lat,lon),b=M.basis(axis);const tangent=M.rotate(b.r,axis,M.radians(turn));return {axis,tangent,length,width};});
const defaults={collection:false,era:'after',routeShades:true,routeGuides:false,multipleWounds:true,starStation:true,regionOrder:1,colorRichness:.8,cycleScale:1,shineField:true,shadeShape:'disk',shadeTrim:.65,antialias:0,shadowSamples:7,stationSamples:64};
const frac=x=>x-Math.floor(x),mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
function frame(q,r){return {lat:Math.asin(M.clamp(M.dot(q,r.normal),-1,1)),lon:Math.atan2(M.dot(q,r.up),M.dot(q,r.right))};}
function region(q,s){let best=10,band=-1,lon=0;routes.forEach((r,i)=>{const f=frame(q,r),v=Math.abs(f.lat)/r.width;if(v<best){best=v;band=i;lon=f.lon;}});
 const r=routes[band],cell=Math.floor((lon/TAU+.5)*r.sectors),count=root.SphereBiomes?10:8,id=((cell+band*3+Math.floor(s.seed))%count+count)%count;
 const c=root.SphereBiomes?root.SphereBiomes.catalog[id].albedo:palette[id],metal=[.018,.023,.028],t=M.clamp((1.15-best)/.25,0,1)*s.regionOrder;
 const coloured=mix([.12,.13,.13],c,s.colorRichness);
 return {color:s.biome>=0&&root.SphereBiomes?root.SphereBiomes.catalog[s.biome].albedo:mix(metal,coloured,t),band,cell,weight:t};
}
function woundDistance(q,w){const a=Math.atan2(M.dot(q,w.tangent),M.dot(q,w.axis)),up=M.cross(w.axis,w.tangent),b=Math.asin(M.clamp(M.dot(q,up),-1,1));const jag=1+.13*Math.sin(a*71)+.055*Math.sin(a*193);return Math.hypot(a/w.length,b/(w.width*jag));}
function missing(q,s){return s.collection&&s.era==='after'&&s.multipleWounds&&wounds.some(w=>woundDistance(q,w)<1);}
let cachedKey='',cachedPlates=[];
function routeFrame(s,band,angle){const r=routes[band];if(s.layoutVersion!==2||!root.SphereWorld){const normal=M.add(M.mul(r.right,Math.cos(angle)),M.mul(r.up,Math.sin(angle)));return {normal,right:r.normal,across:1,latitude:0};}
 const f=root.SphereWorld.frame(s),latitude=M.radians(s.waistWidth)*(band-1)*2/3,sl=Math.sin(latitude),cl=Math.cos(latitude);
 const equator=M.add(M.mul(f.right,Math.cos(angle)),M.mul(f.up,Math.sin(angle))),normal=M.add(M.mul(f.axis,sl),M.mul(equator,cl));
 // The small-circle route follows its habitat ribbon. Cross-track dimensions
 // leave a margin at both ribbon edges, including at the longitudinal corners.
 return {normal,right:M.norm(M.sub(f.axis,M.mul(normal,sl))),across:Math.min(1,Math.tan(M.radians(s.waistWidth)/3*.88)/Math.tan(Math.PI/(2*r.count))),latitude};
}
function plates(s){const key=[s.time,s.cycleScale,s.era,s.routeShades,s.shadeShape,s.shadeTrim,s.biome,s.layoutVersion,s.axisLat,s.axisLon,s.waistWidth].join('|');if(key===cachedKey)return cachedPlates;cachedKey=key;cachedPlates=[];if(!s.routeShades)return cachedPlates;
 routes.forEach((r,b)=>{for(let j=0;j<r.count;j++){
  const destroyed=s.era==='after'&&(j===b+1||j===r.count-2);const fragmented=s.era==='after'&&(j===0||j===r.count-1);
  const a=TAU*(j/r.count+s.time/(r.hours*3600*r.count*s.cycleScale)+r.phase);
  const frame=routeFrame(s,b,a),n=frame.normal,center=M.mul(n,r.radius),size=r.radius*Math.tan(Math.PI/(2*r.count));
  if(!destroyed)cachedPlates.push({center,normal:n,right:frame.right,up:M.cross(n,frame.right),across:frame.across,latitude:frame.latitude,size,damage:fragmented?1:0,id:b*8+j,band:b,shape:s.shadeShape||'disk',trim:s.shadeTrim??.65,layoutVersion:s.layoutVersion||1});
 }});return cachedPlates;
}
function diskContains(x,y,p){x/=p.across||1;if(p.shape==='trimmed'&&Math.abs(x)>p.size*p.trim)return false;if(p.shape==='square'?Math.max(Math.abs(x),Math.abs(y))>p.size:x*x+y*y>p.size*p.size)return false;if(!p.damage)return true;const u=x/p.size,v=y/p.size;
 if(p.layoutVersion===2&&root.SphereWorld)return root.SphereWorld.shadeSolid(u,v,p.id);
 return !(u>.12&&v>-.2)&&Math.abs(u+.3+.16*Math.sin(v*9))>.018&&Math.abs(v+.18+.11*Math.sin(u*10))>.012;
}
function diskDistance(p,d,pl){const epsilon=pl.layoutVersion===2?1e-13:1e-10;
 if((pl.shape==='cap'||pl.shape==='trimmed')){
  const r=M.length(pl.center),b=M.dot(p,d),disc=r*r-M.dot(M.cross(p,d),M.cross(p,d));if(disc<0)return Infinity;const root=Math.sqrt(disc);
  for(const t of [-b-root,-b+root]){if(t<=epsilon)continue;const q=M.mul(M.add(p,M.mul(d,t)),1/r),f=M.dot(q,pl.normal);if(f<=0)continue;if(diskContains(r*M.dot(q,pl.right)/f,r*M.dot(q,pl.up)/f,pl))return t;}return Infinity;
 }
 const denom=M.dot(d,pl.normal);if(Math.abs(denom)<1e-12)return Infinity;const t=M.dot(M.sub(pl.center,p),pl.normal)/denom;if(t<=epsilon)return Infinity;const h=M.sub(M.add(p,M.mul(d,t)),pl.center);return diskContains(M.dot(h,pl.right),M.dot(h,pl.up),pl)?t:Infinity;
}
const ringFrames=[[.2,1,.3],[.6,.25,1]].map(v=>{const n=M.norm(v);return {n,...M.basis(n)};});
function ringDistance(p,d,s){if(!s.starStation)return Infinity;let tmin=Infinity;const star=s.starRadius/s.radius;
 for(let k=0;k<2;k++){const {n,r,u}=ringFrames[k],den=d[0]*n[0]+d[1]*n[1]+d[2]*n[2];if(Math.abs(den)<1e-12)continue;const t=-(p[0]*n[0]+p[1]*n[1]+p[2]*n[2])/den;if(t<=0)continue;const x=p[0]+d[0]*t,y=p[1]+d[1]*t,z=p[2]+d[2]*t,rr=Math.hypot(x,y,z),rad=star*(k?5.2:3.2),a=Math.atan2(x*u[0]+y*u[1]+z*u[2],x*r[0]+y*r[1]+z*r[2]);if(s.era==='after'&&Math.sin(a*3+k)>.75)continue;
 if(Math.abs(rr-rad)<star*.14||(rr>star*1.5&&rr<rad&&Math.abs(Math.sin(a*8))<.022))tmin=Math.min(t,tmin);
 }return tmin;
}
// Surface receivers can round a few ulps beyond R at astronomical coordinates.
// A 1 cm tolerance prevents the shell from falsely occluding its own surface.
function outsideShell(p,s){return s.layoutVersion===2&&M.length(p)>s.radius+Math.max(.00001,s.radius*Number.EPSILON*16);}
function trace(p,d,s){if(!s.collection)return original.trace(p,d,s);const pn=M.mul(p,1/s.radius);let t=M.sphereDistance(pn,d,[0,0,0],s.starRadius/s.radius),kind='Star';
 for(const pl of plates(s)){const hit=diskDistance(pn,d,pl);if(hit<t){t=hit;kind='Shade';}}
 const station=ringDistance(pn,d,s);if(station<t){t=station;kind='Stellar station';}
 const outside=outsideShell(p,s);let shell=(outside?M.sphereDistance(p,d,[0,0,0],s.radius):M.shellDistance(p,d,s.radius))/s.radius,q=M.norm(M.add(pn,M.mul(d,shell)));
 if(outside&&Number.isFinite(shell)&&missing(q,s)){shell=M.shellDistance(p,d,s.radius)/s.radius;q=M.norm(M.add(pn,M.mul(d,shell)));}
 if(shell<t&&!missing(q,s)){t=shell;kind='Inner surface';}
 if(!Number.isFinite(t))return {kind:'Open space',distance:Infinity,point:null};return {kind,distance:t*s.radius,point:M.add(p,M.mul(d,t*s.radius))};
}
const sourceSamples=new Map();
function visibility(p,s,samples=32,ignoreId=-1){if(!s.collection)return original.sunVisibility(p,s,samples);const pn=M.mul(p,1/s.radius),b=M.basis(M.mul(p,-1)),rad=Math.tan(Math.asin(s.starRadius/M.length(p))),dist=M.length(pn);let lit=0;
 // Conservative bounding spheres reject shades outside the entire source cone.
 const pp=plates(s).filter(pl=>{if(pl.id===ignoreId)return false;const to=M.sub(pl.center,pn),bound=pl.size*(pl.shape==='square'?Math.SQRT2:1.01),along=M.dot(to,b.f);return along+bound>0&&along-bound<dist&&M.length(M.cross(to,b.f))<=bound+rad*Math.max(0,along+bound);});
 const outside=outsideShell(p,s);
 if(!pp.length&&!s.starStation&&!outside)return 1;
 if(!sourceSamples.has(samples)){const points=[];for(let i=0;i<samples;i++){const a=i*2.39996323,r=Math.sqrt((i+.5)/samples);points.push([r*Math.cos(a),r*Math.sin(a)]);}sourceSamples.set(samples,points);}
 for(const [sx,sy] of sourceSamples.get(samples)){const x=sx*rad,y=sy*rad,dx=b.f[0]+b.r[0]*x+b.u[0]*y,dy=b.f[1]+b.r[1]*x+b.u[1]*y,dz=b.f[2]+b.r[2]*x+b.u[2]*y,inv=1/Math.hypot(dx,dy,dz),d=[dx*inv,dy*inv,dz*inv];const st=M.sphereDistance(pn,d,[0,0,0],s.starRadius/s.radius);const shell=outside?M.sphereDistance(p,d,[0,0,0],s.radius):Infinity;const shellClear=!outside||!Number.isFinite(shell)||missing(M.norm(M.add(p,M.mul(d,shell))),s);if(shellClear&&pp.every(pl=>diskDistance(pn,d,pl)>=st)&&ringDistance(pn,d,s)>=st)lit++;}return lit/samples;
}
let shineKey='',shine=[0,0,0];
function cavity(s){const key=[s.era,s.seed,s.regionOrder,s.colorRichness,s.multipleWounds,s.routeShades,s.starStation,s.stationSamples,s.cycleScale,s.time,s.luminosity,s.radius,s.starRadius,s.shadeShape,s.shadeTrim,s.biome].join('|');if(key===shineKey)return shine;shineKey=key;shine=[0,0,0];const N=192;
 for(let i=0;i<N;i++){const y=1-2*(i+.5)/N,a=i*2.39996323,q=[Math.sqrt(1-y*y)*Math.cos(a),y,Math.sqrt(1-y*y)*Math.sin(a)];if(missing(q,s))continue;let col=region(q,s).color;if(s.era==='after'){const scar=Math.max(...wounds.map(w=>Math.exp(-Math.max(0,woundDistance(q,w)-1)*2)));col=mix(col,[.04,.031,.026],scar*.85*(s.multipleWounds?1:0));}
 const light=visibility(M.mul(q,s.radius),s,s.starStation?(s.stationSamples||64):1)*s.luminosity*(M.AU/s.radius)**2;shine=M.add(shine,M.mul(col,light/N));}return shine;
}
const original={defaultState:M.defaultState,validate:M.validate,trace:M.trace,sunVisibility:M.sunVisibility,inBreach:M.inBreach};
M.defaultState=()=>({...original.defaultState(),...defaults});
M.validate=input=>{const s=original.validate(input);Object.assign(s,defaults);for(const k of ['collection','routeShades','routeGuides','multipleWounds','starStation','shineField'])if(k in input){if(typeof input[k]!=='boolean')throw Error('Invalid '+k);s[k]=input[k];}
 if('era' in input){if(!['before','after'].includes(input.era))throw Error('Invalid era');s.era=input.era;}
 if('shadeShape' in input){if(!['disk','square','cap','trimmed'].includes(input.shadeShape))throw Error('Invalid shade shape');s.shadeShape=input.shadeShape;}
 for(const [k,lo,hi] of [['shadeTrim',.25,1],['regionOrder',0,1],['colorRichness',0,1],['cycleScale',.25,4]])if(k in input){if(!Number.isFinite(input[k])||input[k]<lo||input[k]>hi)throw Error('Invalid '+k);s[k]=input[k];}for(const [k,allowed] of [['antialias',[0,2,3]],['shadowSamples',[7,19]],['stationSamples',[19,64,128,256]]])if(k in input){if(!allowed.includes(input[k]))throw Error('Invalid '+k);s[k]=input[k];}return s;};
M.trace=trace;M.sunVisibility=visibility;M.inBreach=(q,s)=>s.collection?missing(M.norm(q),s):original.inBreach(q,s);
root.SphereCollection={routes,routeFrame,wounds,plates,missing,woundDistance,diskContains,diskDistance,ringDistance,region,cavity,defaults,visibility};
})(typeof window==='undefined'?globalThis:window);
