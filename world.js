/* Versioned geography. Kilometres, radians and double precision; shared with workers. */
(function(root){
'use strict';
const M=root.SphereMath,C=root.SphereCollection,B=root.SphereBiomes,TAU=2*Math.PI;
const smooth=(a,b,x)=>{const t=M.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((x,i)=>x*(1-t)+b[i]*t);
const fractions=[0,.085,.18,.235,.35,.43,.56,.64,.74,.86,1];
const provinces=[[0,1,6,7,2,3,9,8,4,5],[1,6,7,2,5,4,3,9,8,0],[6,7,2,3,9,5,4,8,0,1]];
const names=[...B.catalog.map(b=>b.name),'Thermal routing fields','Air and water works','Fabrication and repair','Shade · star-facing','Shade · shell-facing','Polar entry complex'];
const palette=root.SpherePalette||[...B.catalog.map(b=>b.albedo),[.067,.058,.048],[.055,.092,.09],[.071,.075,.075],[.038,.042,.044],[.103,.112,.117],[.17,.19,.20]];
// The damage envelope is fixed to the world, in kilometres. Image detail has its
// own distance LOD; moving the observer must never move the damaged ground.
const woundBandKm=240,woundTileKm=.64;
const woundPalette=[[0.0879325,0.0799839,0.0633625],[0.07882,0.0769532,0.0525908],[0.272146,0.172813,0.1008225],[0.3083736,0.35433,0.4262165],[0.1258312,0.1139518,0.1043117],[0.0979859,0.0912297,0.0852073],[0.1357987,0.0912006,0.0612558],[0.4244428,0.4054941,0.3718626],[0.1242854,0.1353919,0.131049],[0.1290659,0.1011284,0.130596]]; // Measured linear-sRGB means; see assets/wound-edges/manifest.json.
const edgeBiome=id=>id<10?id:5;
const woundBlend=km=>1-smooth(0,woundBandKm,Math.max(0,km));
function woundGradient(a,b,w){const j=1+.13*Math.sin(a*71)+.055*Math.sin(a*193),dj=.13*71*Math.cos(a*71)+.055*193*Math.cos(a*193);
 return Math.hypot((2*a/w.length**2-2*b*b*dj/(w.width**2*j**3))/Math.max(1e-12,Math.cos(b)),2*b/(w.width**2*j*j));}
function woundDistance(q,s){
 if(s.era!=='after'||!s.multipleWounds)return Infinity;
 let distance=Infinity;for(const w of C.wounds){const a=Math.atan2(M.dot(q,w.tangent),M.dot(q,w.axis)),b=Math.asin(M.clamp(M.dot(q,M.cross(w.axis,w.tangent)),-1,1)),j=1+.13*Math.sin(a*71)+.055*Math.sin(a*193),f=(a/w.length)**2+(b/(w.width*j))**2-1;
  // Gradient normalization is local: far from the rim its coordinate pole is
  // not a distance estimate. The coarse bound keeps those poles undamaged.
  distance=Math.min(distance,(f>.44?(Math.sqrt(f+1)-1)*w.width:f/Math.max(1e-12,woundGradient(a,b,w)))*s.radius);
 }return distance;
}
const defaults={layoutVersion:2,axisLat:63,axisLon:-28,waistWidth:20,transitionKm:60000,shellThickness:12,geometryDetail:true,richMaterials:true,localShadows:1,wreckage:true,clouds:true,weatherStrength:.55,weatherQuality:1,cavityHaze:.28,spaceEnvironment:0,siteId:'',siteAnchor:null,walkMode:false,walkPosition:null,walkVelocity:0,shadeAttachment:null,surfaceLock:true};
const oldDefault=M.defaultState,oldValidate=M.validate,oldRegion=B.region,oldCollectionRegion=C.region,oldCavity=C.cavity;
M.defaultState=()=>({...oldDefault(),...defaults});
M.validate=input=>{
 const s=oldValidate(input);Object.assign(s,defaults);s.layoutVersion=input.layoutVersion??1;
 if(![1,2].includes(s.layoutVersion))throw Error('Unsupported world layout version');
 for(const [k,lo,hi] of [['axisLat',-90,90],['axisLon',-180,180],['waistWidth',10,38],['transitionKm',100,500000],['shellThickness',.1,1000],['weatherStrength',0,1],['weatherQuality',0,2],['localShadows',0,2],['cavityHaze',0,1],['spaceEnvironment',0,2]])if(k in input){if(!Number.isFinite(input[k])||input[k]<lo||input[k]>hi||(['spaceEnvironment','weatherQuality','localShadows'].includes(k)&&!Number.isInteger(input[k])))throw Error('Invalid '+k);s[k]=input[k];}
 for(const k of ['geometryDetail','richMaterials','wreckage','clouds','walkMode','surfaceLock'])if(k in input){if(typeof input[k]!=='boolean')throw Error('Invalid '+k);s[k]=input[k];}
 s.siteId=input.siteId??'';if(typeof s.siteId!=='string'||!/^$|^(biome-[0-9]|rim|shade-[0-9]{1,2}|port-[01]|exterior-[012])$/.test(s.siteId))throw Error('Invalid field site');
 for(const k of ['siteAnchor','walkPosition'])if(input[k]!=null){if(!Array.isArray(input[k])||input[k].length!==3||!input[k].every(Number.isFinite))throw Error('Invalid '+k);s[k]=input[k].slice();}
 if(s.siteAnchor&&Math.abs(M.length(s.siteAnchor)-1)>1e-10)throw Error('Invalid site anchor');
 if(s.siteId&&!s.siteAnchor)throw Error('A field site requires its saved anchor');
 if(s.walkPosition&&(Math.abs(s.walkPosition[0])>1.2||Math.abs(s.walkPosition[2])>1.2||s.walkPosition[1]<0||s.walkPosition[1]>1))throw Error('Walking position is outside this site');
 if(s.walkMode&&(!s.siteAnchor||!s.walkPosition||!s.siteId))throw Error('Walking requires a field site');
 if(s.walkMode&&!/^(biome|port)-/.test(s.siteId))throw Error('This destination does not support walking');
 if('walkVelocity' in input){if(!Number.isFinite(input.walkVelocity)||Math.abs(input.walkVelocity)>.1)throw Error('Invalid walking velocity');s.walkVelocity=input.walkVelocity;}
 if(s.layoutVersion===1){s.siteId='';s.siteAnchor=null;s.walkMode=false;s.walkPosition=null;}
 s.shadeAttachment=input.shadeAttachment??null;
 if(s.shadeAttachment!==null&&(!Number.isInteger(s.shadeAttachment)||s.shadeAttachment<0||s.shadeAttachment>19))throw Error('Invalid Shade attachment');
 if(s.shadeAttachment!==null&&(s.siteId!=='shade-'+s.shadeAttachment||!s.routeShades||!C.plates(s).some(p=>p.id===s.shadeAttachment)))s.shadeAttachment=null;
 return s;
};
function frame(s){const axis=M.axis(s.axisLat??defaults.axisLat,s.axisLon??defaults.axisLon),right=M.basis(axis).r;return {axis,right,up:M.cross(axis,right)};}
function coordinates(q,s){const f=frame(s);return {lat:Math.asin(M.clamp(M.dot(q,f.axis),-1,1)),lon:Math.atan2(M.dot(q,f.up),M.dot(q,f.right))};}
function direction(lat,lon,s){const f=frame(s);return M.add(M.mul(f.axis,Math.sin(lat)),M.add(M.mul(f.right,Math.cos(lat)*Math.cos(lon)),M.mul(f.up,Math.cos(lat)*Math.sin(lon))));}
function province(row,u,s){u=((u%1)+1)%1;let cell=9;for(let i=0;i<10;i++)if(u<fractions[i+1]){cell=i;break;}let id=provinces[row][cell];if(id===4&&s.era==='before')id=5;return {id,cell};}
function woundMetric(q,s){let metric=Infinity,index=-1;if(s.era!=='after'||!s.multipleWounds)return {metric,index,km:Infinity};C.wounds.forEach((w,i)=>{const d=C.woundDistance(q,w);if(d<metric){metric=d;index=i;}});return {metric,index,km:(metric-1)*C.wounds[index].width*s.radius};}
function sample(q,s){
 if(s.layoutVersion!==2){const r=oldCollectionRegion(q,s),id=oldRegion(q,s);return {a:id,b:id,blend:0,id,biome:id,name:names[id],lat:0,lon:0,damage:0,color:r.color,band:r.band,cell:r.cell,weight:r.weight,boundary:0};}
 const {lat,lon}=coordinates(q,s),width=M.radians(s.waistWidth),latitude=Math.abs(lat),u=(lon/TAU+.5)%1;
 const row=M.clamp(Math.floor((lat+width)/(2*width)*3),0,2),warp=.006*Math.sin(lon*7+row*1.7)+.002*Math.sin(lon*19+row*2.3);
 const pu=((u+warp)%1+1)%1,p=province(row,pu,s),belt=1-smooth(width-.004,width+.004,latitude);
 let a=p.id,b=a,blend=0,boundary=0;
 const machine=10+((Math.floor(u*8)+(lat<0?1:0))%3);
 if(latitude>width){a=machine;b=a;}
 if(latitude>1.31){a=15;b=15;}
 if(belt>0&&belt<1){a=machine;b=p.id;blend=belt;boundary=1;}
 else if(latitude<width){
  const fade=s.transitionKm/s.radius/(TAU*Math.max(.1,Math.cos(lat))),left=pu-fractions[p.cell],right=fractions[p.cell+1]-pu;
  if(left<fade){a=province(row,pu-fade*2,s).id;b=p.id;blend=.5+.5*smooth(0,fade,left);}
  else if(right<fade){a=p.id;b=province(row,pu+fade*2,s).id;blend=.5*(1-smooth(0,fade,right));}
  const ribbon=(lat+width)/(2*width)*3,rf=s.transitionKm/s.radius/(2*width/3),frac=ribbon-Math.floor(ribbon);
  if(row>0&&frac<rf){a=province(row-1,pu,s).id;b=p.id;blend=.5+.5*smooth(0,rf,frac);}
  if(row<2&&1-frac<rf){a=p.id;b=province(row+1,pu,s).id;blend=.5*(1-smooth(0,rf,1-frac));}
  boundary=a===b?0:([3,9].includes(a)||[3,9].includes(b)?2:[4,5].includes(a)||[4,5].includes(b)?1:0);
 }
 if(s.biome>=0){a=s.biome;b=a;blend=0;}
 const damage=woundBlend(woundDistance(q,s)),id=blend>.5?b:a;
 const color=mix(mix(palette[a],palette[b],blend),mix(woundPalette[edgeBiome(a)],woundPalette[edgeBiome(b)],blend),damage);
 return {a,b,blend,id,biome:id<10?id:5,name:names[id],lat,lon,damage,color,band:row,cell:p.cell,weight:latitude<width?1:0,boundary};
}
B.region=(q,s)=>s.collection&&s.layoutVersion===2?sample(q,s).biome:oldRegion(q,s);
C.region=(q,s)=>s.layoutVersion===2?sample(q,s):oldCollectionRegion(q,s);
let cavityKey='',cavityColor=[0,0,0];
C.cavity=s=>{if(s.layoutVersion!==2)return oldCavity(s);const key=JSON.stringify([s.time,s.seed,s.era,s.radius,s.luminosity,s.starRadius,s.axisLat,s.axisLon,s.waistWidth,s.transitionKm,s.multipleWounds,s.routeShades,s.starStation,s.stationSamples,s.cycleScale,s.shadeShape,s.shadeTrim,s.biome]);if(key===cavityKey)return cavityColor;cavityKey=key;cavityColor=[0,0,0];const count=192;
 for(let i=0;i<count;i++){const y=1-2*(i+.5)/count,a=i*2.39996323,q=[Math.sqrt(1-y*y)*Math.cos(a),y,Math.sqrt(1-y*y)*Math.sin(a)];if(C.missing(q,s))continue;const color=sample(q,s).color,light=C.visibility(M.mul(q,s.radius),s,s.starStation?s.stationSamples:19)*s.luminosity*(M.AU/s.radius)**2;for(let j=0;j<3;j++)cavityColor[j]+=color[j]*light/count;}return cavityColor;};
function boundaryPoint(index,t){const w=C.wounds[index],a=w.length*Math.cos(t),jag=1+.13*Math.sin(a*71)+.055*Math.sin(a*193),b=w.width*jag*Math.sin(t),up=M.cross(w.axis,w.tangent);return M.add(M.mul(up,Math.sin(b)),M.add(M.mul(w.axis,Math.cos(b)*Math.cos(a)),M.mul(w.tangent,Math.cos(b)*Math.sin(a))));}
function nearestRim(q,s){let best={distance:Infinity};for(let index=0;index<C.wounds.length;index++){let t=0,score=Infinity;for(let j=0;j<192;j++){const v=M.length(M.sub(q,boundaryPoint(index,j*TAU/192)));if(v<score){score=v;t=j*TAU/192;}}let lo=t-TAU/192,hi=t+TAU/192;for(let k=0;k<56;k++){const a=(2*lo+hi)/3,b=(lo+2*hi)/3;if(M.length(M.sub(q,boundaryPoint(index,a)))<M.length(M.sub(q,boundaryPoint(index,b))))hi=b;else lo=a;}t=(lo+hi)/2;const point=boundaryPoint(index,t),distance=Math.atan2(M.length(M.cross(q,point)),M.dot(q,point))*s.radius;if(distance<best.distance)best={index,t,point,distance};}return best;}
function rimFrame(s,index=0,t=Math.PI/2){const point=boundaryPoint(index,t),tangent=M.norm(M.sub(boundaryPoint(index,t+.00001),boundaryPoint(index,t-.00001)));let inland=M.norm(M.cross(point,tangent));if(C.woundDistance(M.norm(M.add(point,M.mul(inland,1e-6))),C.wounds[index])<1)inland=M.mul(inland,-1);return {point,tangent,inland};}
function locateBiome(id,s){let best=null,light=-1;for(let row=0;row<3;row++)for(let j=0;j<10;j++)for(const offset of [.5,.25,.75]){const q=direction(M.radians(s.waistWidth)*((row+.5)/3*2-1),TAU*((fractions[j]+(fractions[j+1]-fractions[j])*offset)-.5),s);if(sample(q,{...s,biome:-1}).id!==id||C.missing(q,s))continue;const visibility=C.visibility(M.mul(q,s.radius),s,19);if(visibility>light){best=q;light=visibility;}if(visibility===1)return q;}if(best)return best;if(id===4&&s.era==='after'){const f=rimFrame(s);return M.norm(M.add(f.point,M.mul(f.inland,100/s.radius)));}return direction(0,0,s);}

function physics(s){const mu=1.32712440041279419e11,c=299792.458;return {lightSeconds:s.radius/c,routes:C.routes.map((r,i)=>({radiusKm:r.radius*s.radius,maintainedDays:r.hours*r.count*s.cycleScale/24,keplerDays:TAU*Math.sqrt((r.radius*s.radius)**3/mu)/86400,speedKmSec:TAU*r.radius*s.radius*Math.cos(C.routeFrame(s,i,0).latitude)/(r.hours*r.count*3600*s.cycleScale)}))};}
// Three authored fracture families. The GPU uses this same expression below.
const shadeSolidBody=`
 const family=id%3;
 const edge=.09+.055*Math.sin(v*17)+.017*Math.sin(v*53);
 if(family===0&&u>edge&&v>-.31)return false;
 if(family===1&&v>.13+.10*Math.sin(u*12)&&u>-.43)return false;
 if(family===2&&u+.36*v>.20+.04*Math.sin(v*31))return false;
 if(Math.abs(u+.27+.065*Math.sin(v*11)+.018*Math.sin(v*41))<.013)return false;
 if(Math.abs(v+.28+.052*Math.sin(u*17)+.011*Math.sin(u*57))<.009)return false;
 const x=Math.floor((u+1)*18),y=Math.floor((v+1)*18);
 if((x*13+y*7+id*11)%37===0&&Math.abs((u+1)*18-x-.5)<.29&&Math.abs((v+1)*18-y-.5)<.34)return false;
 return true;`;
const shadeSolid=Function('u','v','id',shadeSolidBody);
root.SphereWorld={defaults,frame,coordinates,direction,sample,palette,names,provinces,fractions,smooth,woundMetric,woundDistance,woundGradient,woundBlend,woundPalette,woundBandKm,woundTileKm,edgeBiome,boundaryPoint,nearestRim,rimFrame,locateBiome,physics,shadeSolid,shadeSolidBody};
})(typeof window==='undefined'?globalThis:window);
