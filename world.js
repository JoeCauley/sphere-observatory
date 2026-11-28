/* Versioned geography. Kilometres, radians and double precision; shared with workers. */
(function(root){
'use strict';
const M=root.SphereMath,C=root.SphereCollection,B=root.SphereBiomes,TAU=2*Math.PI;
const Packs=root.SpherePacks||(typeof require==='function'?require('./biome-packs.js'):null);
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
const defaults={terrainAnchor:null,terrainRevision:2,geographyRevision:null,shadeGeometryRevision:3,shadeFractureRevision:2,packAddress:null,layoutVersion:2,provinceRevision:0,provinceSeed:713,provinceAnchor:null,axisLat:63,axisLon:-28,waistWidth:20,transitionKm:60000,shellThickness:12,geometryDetail:true,richMaterials:true,localShadows:1,wreckage:true,clouds:true,weatherStrength:.55,weatherQuality:1,cavityHaze:.28,spaceEnvironment:0,siteId:'',siteAnchor:null,siteRevision:0,siteElevation:0,autoWalk:true,autoSpeed:true,placeScene:'day',placeWeather:'mixed',walkSurface:false,walkMode:false,walkPosition:null,walkVelocity:0,shadeAttachment:null,surfaceLock:true};
const oldDefault=M.defaultState,oldValidate=M.validate,oldRegion=B.region,oldCollectionRegion=C.region,oldCavity=C.cavity;
M.defaultState=()=>({...oldDefault(),...defaults});
M.validate=input=>{
 const s=oldValidate(input);Object.assign(s,defaults);s.layoutVersion=input.layoutVersion??1;
 if(![1,2].includes(s.layoutVersion))throw Error('Unsupported world layout version');
 // Province revision is independent of the shell layout. Missing fields mean
 // the original scene, including every version-one and version-two import.
 s.provinceRevision=input.provinceRevision??0;
 if(![0,1].includes(s.provinceRevision))throw Error('Unsupported province revision');
 s.provinceSeed=input.provinceSeed??713;
 if(!Number.isInteger(s.provinceSeed)||s.provinceSeed<0||s.provinceSeed>2147483647)throw Error('Invalid province seed');
 s.provinceAnchor=input.provinceAnchor??null;
 if(s.provinceAnchor!==null){if(!Array.isArray(s.provinceAnchor)||s.provinceAnchor.length!==3||!s.provinceAnchor.every(Number.isFinite)||Math.abs(M.length(s.provinceAnchor)-1)>1e-10)throw Error('Invalid province anchor');s.provinceAnchor=s.provinceAnchor.slice();}
 if(s.provinceRevision&&(!s.provinceAnchor||s.layoutVersion!==2||!s.collection))throw Error('The Watershed province requires its saved anchor and designed shell');
 s.packAddress=Packs.validate(input.packAddress,s);
 for(const [k,lo,hi] of [['axisLat',-90,90],['axisLon',-180,180],['waistWidth',10,38],['transitionKm',100,500000],['shellThickness',.1,1000],['weatherStrength',0,1],['weatherQuality',0,2],['localShadows',0,2],['cavityHaze',0,1],['spaceEnvironment',0,2]])if(k in input){if(!Number.isFinite(input[k])||input[k]<lo||input[k]>hi||(['spaceEnvironment','weatherQuality','localShadows'].includes(k)&&!Number.isInteger(input[k])))throw Error('Invalid '+k);s[k]=input[k];}
 for(const k of ['geometryDetail','richMaterials','wreckage','clouds','walkMode','surfaceLock','autoWalk','autoSpeed','walkSurface'])if(k in input){if(typeof input[k]!=='boolean')throw Error('Invalid '+k);s[k]=input[k];}
 for(const [key,choices] of [['placeScene',['first-light','darkness','day','dark']],['placeWeather',['clear','mixed','cover','precipitation','storm']]])if(key in input){if(!choices.includes(input[key]))throw Error('Invalid '+key);s[key]=input[key];}
 s.shadeGeometryRevision=input.shadeGeometryRevision??1;
 if(![1,2,3].includes(s.shadeGeometryRevision))throw Error('Unsupported Shade geometry revision');
 // Unversioned portable scenes use the original footprint and retain their
 // original serialized shape. Newly authored scenes specify the current model.
 if(input.shadeFractureRevision===undefined)delete s.shadeFractureRevision;
 else{
  if(![1,2].includes(input.shadeFractureRevision))throw Error('Unsupported Shade fracture revision');
  s.shadeFractureRevision=input.shadeFractureRevision;
 }
 s.terrainRevision=input.terrainRevision??1;
 if(![1,2].includes(s.terrainRevision))throw Error('Unsupported terrain revision');
 s.geographyRevision=input.geographyRevision??null;
 if(s.geographyRevision!==null&&(!Number.isInteger(s.geographyRevision)||![1,2].includes(s.geographyRevision)))throw Error('Unsupported geography revision');
 s.siteRevision=input.siteRevision??0;s.siteElevation=input.siteElevation??0;
 if(![0,1,2].includes(s.siteRevision)||!Number.isFinite(s.siteElevation)||s.siteElevation<0||s.siteElevation>10)throw Error('Invalid walking patch');
 s.siteId=input.siteId??'';if(typeof s.siteId!=='string'||!/^$|^(biome-[0-9]|rim|shade-[0-9]{1,2}|port-[01]|exterior-[012])$/.test(s.siteId))throw Error('Invalid field site');
 for(const k of ['siteAnchor','terrainAnchor','walkPosition'])if(input[k]!=null){if(!Array.isArray(input[k])||input[k].length!==3||!input[k].every(Number.isFinite))throw Error('Invalid '+k);s[k]=input[k].slice();}
 if(s.terrainAnchor&&Math.abs(M.length(s.terrainAnchor)-1)>1e-10)throw Error('Invalid terrain anchor');
 if(s.siteAnchor&&Math.abs(M.length(s.siteAnchor)-1)>1e-10)throw Error('Invalid site anchor');
 if(s.siteId&&!s.siteAnchor)throw Error('A field site requires its saved anchor');
 if(s.siteRevision===2&&s.walkPosition&&s.walkPosition.some(v=>Math.abs(v)>100))throw Error('Walking coordinates require a nearby terrain frame');
 if(s.siteRevision!==2&&s.walkPosition&&(Math.abs(s.walkPosition[0])>1.2||Math.abs(s.walkPosition[2])>1.2||s.walkPosition[1]<(s.siteRevision===1?-5:0)||s.walkPosition[1]>(s.siteRevision===1?5:1)))throw Error('Walking position is outside this site');
 if(s.siteRevision>=1&&!/^(biome|port)-/.test(s.siteId)){s.siteRevision=0;s.siteElevation=0;}
 if(s.walkSurface&&!s.walkMode)s.walkSurface=false;
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
function habitatU(lon,row){return lon/TAU+.5+.006*Math.sin(lon*7+row*1.7)+.002*Math.sin(lon*19+row*2.3);}
let meridians;
function habitatMeridians(){
 if(meridians)return meridians;
 const result=[];
 for(let row=0;row<3;row++)for(const boundary of fractions.slice(0,-1)){
  // The warped longitude is monotonic. Include the wrapped zero boundary.
  let lo=-Math.PI,hi=Math.PI,target=boundary;
  if(target<habitatU(lo,row))target++;
  if(target>habitatU(hi,row))target--;
  for(let j=0;j<55;j++){const mid=(lo+hi)/2;if(habitatU(mid,row)<target)lo=mid;else hi=mid;}
  result.push((lo+hi)/2);
 }
 return meridians=Object.freeze(result);
}
function province(row,u,s){u=((u%1)+1)%1;let cell=9;for(let i=0;i<10;i++)if(u<fractions[i+1]){cell=i;break;}let id=provinces[row][cell];if(id===4&&s.era==='before')id=5;return {id,cell};}
function woundMetric(q,s){let metric=Infinity,index=-1;if(s.era!=='after'||!s.multipleWounds)return {metric,index,km:Infinity};C.wounds.forEach((w,i)=>{const d=C.woundDistance(q,w);if(d<metric){metric=d;index=i;}});return {metric,index,km:(metric-1)*C.wounds[index].width*s.radius};}
function sample(q,s){
 if(s.layoutVersion!==2){const r=oldCollectionRegion(q,s),id=oldRegion(q,s);return {a:id,b:id,blend:0,id,biome:id,name:names[id],lat:0,lon:0,damage:0,color:r.color,band:r.band,cell:r.cell,weight:r.weight,boundary:0};}
 const {lat,lon}=coordinates(q,s),width=M.radians(s.waistWidth),latitude=Math.abs(lat),u=(lon/TAU+.5)%1;
 const row=M.clamp(Math.floor((lat+width)/(2*width)*3),0,2);
 const pu=((habitatU(lon,row)%1)+1)%1,p=province(row,pu,s),belt=1-smooth(width-.004,width+.004,latitude);
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
C.cavity=s=>{if(s.layoutVersion!==2)return oldCavity(s);const key=JSON.stringify([s.time,s.seed,s.era,s.radius,s.luminosity,s.starRadius,s.axisLat,s.axisLon,s.waistWidth,s.transitionKm,s.multipleWounds,s.routeShades,s.starStation,s.stationSamples,s.cycleScale,s.shadeShape,s.shadeTrim,s.shadeFractureRevision,s.biome]);if(key===cavityKey)return cavityColor;cavityKey=key;cavityColor=[0,0,0];const count=192;
 for(let i=0;i<count;i++){const y=1-2*(i+.5)/count,a=i*2.39996323,q=[Math.sqrt(1-y*y)*Math.cos(a),y,Math.sqrt(1-y*y)*Math.sin(a)];if(C.missing(q,s))continue;const color=sample(q,s).color,light=C.visibility(M.mul(q,s.radius),s,s.starStation?s.stationSamples:19)*s.luminosity*(M.AU/s.radius)**2;for(let j=0;j<3;j++)cavityColor[j]+=color[j]*light/count;}return cavityColor;};
function boundaryPoint(index,t){const w=C.wounds[index],a=w.length*Math.cos(t),jag=1+.13*Math.sin(a*71)+.055*Math.sin(a*193),b=w.width*jag*Math.sin(t),up=M.cross(w.axis,w.tangent);return M.add(M.mul(up,Math.sin(b)),M.add(M.mul(w.axis,Math.cos(b)*Math.cos(a)),M.mul(w.tangent,Math.cos(b)*Math.sin(a))));}
const rimSearchSamples=new WeakMap();
function nearestRim(q,s){let best={distance:Infinity};for(let index=0;index<C.wounds.length;index++){let t=0,score=Infinity;const wound=C.wounds[index],signature=[wound.length,wound.width,...wound.axis,...wound.tangent].join(',');let saved=rimSearchSamples.get(wound);
 // Fixed contour samples do not change when the camera moves. Keep the exact
 // original search and refinement, including its double-precision distances.
 if(saved?.signature!==signature){saved={signature,points:Array.from({length:192},(_,j)=>boundaryPoint(index,j*TAU/192))};rimSearchSamples.set(wound,saved);}
 for(let j=0;j<192;j++){const p=saved.points[j],v=Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2]);if(v<score){score=v;t=j*TAU/192;}}let lo=t-TAU/192,hi=t+TAU/192;for(let k=0;k<56;k++){const a=(2*lo+hi)/3,b=(lo+2*hi)/3;if(M.length(M.sub(q,boundaryPoint(index,a)))<M.length(M.sub(q,boundaryPoint(index,b))))hi=b;else lo=a;}t=(lo+hi)/2;const point=boundaryPoint(index,t),distance=Math.atan2(M.length(M.cross(q,point)),M.dot(q,point))*s.radius;if(distance<best.distance)best={index,t,point,distance};}return best;}
function rimFrame(s,index=0,t=Math.PI/2){const point=boundaryPoint(index,t),tangent=M.norm(M.sub(boundaryPoint(index,t+.00001),boundaryPoint(index,t-.00001)));let inland=M.norm(M.cross(point,tangent));if(C.woundDistance(M.norm(M.add(point,M.mul(inland,1e-6))),C.wounds[index])<1)inland=M.mul(inland,-1);return {point,tangent,inland};}
function locateBiome(id,s,{sunlit=true}={}){let best=null,light=-1;for(let row=0;row<3;row++)for(let j=0;j<10;j++)for(const offset of [.5,.25,.75]){const q=direction(M.radians(s.waistWidth)*((row+.5)/3*2-1),TAU*((fractions[j]+(fractions[j+1]-fractions[j])*offset)-.5),s);if(sample(q,{...s,biome:-1}).id!==id||C.missing(q,s))continue;if(!sunlit)return q;const visibility=C.visibility(M.mul(q,s.radius),s,19);if(visibility>light){best=q;light=visibility;}if(visibility===1)return q;}if(best)return best;if(id===4&&s.era==='after'){const f=rimFrame(s);return M.norm(M.add(f.point,M.mul(f.inland,100/s.radius)));}return direction(0,0,s);}

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
/*
 * Reduced plate-girder failure model. A lost outboard support does work on the
 * neighbouring bays; a joint can unzip only while that strip has fracture work
 * left. A crack deflects down a panel seam and arrests at a supported crossbeam.
 * Loads and toughness are relative; this describes a frozen damage state.
 */
function buildShadeFracture(){
 const bayWidth=.15,rowPitch=.24,rowBelow=.070,rowAbove=.052,reach=2.8;
 const bank=[[1.32,-reach]];
 for(let row=-4;row<=4;row++){
  const y=.12+row*rowPitch;
  const transfer=Math.max(0,1-Math.abs(row)/4.5);
  let work=1.18*transfer**1.4,failed=0;
  for(let bay=0;bay<10;bay++){
   // Alternate braced and unbraced splice rows. Each released strip consumes
   // the work of the two cracked ligaments plus a stronger inner cross-frame.
   const toughness=.101+.018*((bay+Math.abs(row))%3)+.010*bay;
   if(work<toughness)break;
   work-=toughness;failed++;
  }
  const x=1.18-bayWidth*failed;
  bank.push([x,y-rowBelow],[x,y+rowAbove]);
 }
 bank.push([1.32,reach]);
 const root=bank[1+2*4][0];
 // For a tension tear, opening behind its tip grows with the square root
 // of distance. The hinge at the splice redirects some opening into a branch.
 const mouth=[root+.18,.12],hinge=[root-.30,.045],tip=[root-.92,-.24];
 const mouthHalf=.112,hingeHalf=mouthHalf*Math.sqrt((hinge[0]-tip[0])/(mouth[0]-tip[0]));
 const low=[hinge[0],hinge[1]-hingeHalf],high=[hinge[0],hinge[1]+hingeHalf];
 const fractures=[
  {id:'released-bay',points:[...bank,[reach,reach],[reach,-reach]]},
  {id:'seam-mouth',points:[[mouth[0],mouth[1]-mouthHalf],[mouth[0],mouth[1]+mouthHalf],high,low]},
  {id:'arrested-tear',points:[high,tip,low]},
  {id:'branch',points:[[hinge[0]+.055,hinge[1]],[hinge[0]-.026,hinge[1]],[hinge[0]-.31,hinge[1]+.38]]}
 ];
 // The per-Shade load frame controls impact direction, eccentricity and the
 // length of unsupported bays. Both maps are affine, so all edges stay planar.
 const transforms=Array.from({length:20},(_,id)=>{
  const [c,s]=[[1,0],[0,1],[.8,.6]][id%3],mirror=id%2?-1:1;
  const ax=.9+.13*(id%4),ay=.82+.13*((id+1)%4),shear=.075*(id%5-2);
  return [ax*c-shear*mirror*s,ax*s+shear*mirror*c,-ay*mirror*s,ay*mirror*c,
          .14*(id%4)-.12,.19*((id*3+2)%5)-.30];
 });
 // Independent event inputs for the five damaged survivors. An oblique release
 // racks the first failed bay; a branch opens only if transferred work exceeds
 // the spare cross-tie's capacity. Lower work arrests the main tear earlier.
 const loads={0:[.48,-.55,.64],7:[.92,.30,.47],8:[1.23,-.64,.50],13:[.54,.84,.65],16:[.98,.57,.56]};
 const responses=transforms.map((_,id)=>{
  const [work,rack,tie]=loads[id]||[.78,.15,.55],branch=.5*work+.3*Math.abs(rack)>tie;
  return [1/(.28+.82*work),1/(.32+.89*work*work),rack,branch?(rack<0?-1:1):0];
 });
 function damagePoint(x,y,id,branch){
  const [length,opening,rack,hand]=responses[id],dx=x-root;
  const v=.12+(y-.12-rack*dx)*opening;
  return [root+dx*length,branch&&hand<0?2*hinge[1]-v:v];
 }
 function fromDamage(x,y,id,branch){
  const [length,opening,rack,hand]=responses[id],dx=(x-root)/length;
  const v=branch&&hand<0?2*hinge[1]-y:y;
  return [root+dx,.12+(v-.12)/opening+rack*dx];
 }
 const planes=[],thresholds=[];
 const addPlane=(a,b,c)=>{const length=Math.hypot(a,b);return planes.push([a/length,b/length,c/length])-1;};
 const banks=bank.slice(1).map(([x1,y1],i)=>{
  const [x,y]=bank[i],slope=(x1-x)/(y1-y);
  if(i>0)thresholds.push(addPlane(0,1,-y));
  return addPlane(-1,slope,x-slope*y);
 });
 const polygons=fractures.slice(1).map(({points})=>{
  const sum=points.reduce((n,[x,y],i)=>{const b=points[(i+1)%points.length];return n+x*b[1]-y*b[0];},0),sign=Math.sign(sum);
  return points.map(([x,y],i)=>{
   const [x1,y1]=points[(i+1)%points.length],a=sign*(y1-y),b=sign*(x-x1);
   return addPlane(a,b,-a*x-b*y);
  });
 });
 // The two tapered pieces meet at the hinge. Its shared plane chooses the
 // active side walls and is never a solid cap across the open channel.
 const hingePlane=polygons[0][2],mouthWalls=polygons[0].filter((_,i)=>i!==2),tipWalls=polygons[1].slice(0,2);
 const bankEnd=polygons[0][0],branchStart=polygons[2][0];
 function framePoint(u,v,id){
  const [a,b,c,d,x,y]=transforms[id];
  return [a*u+b*v+x,c*u+d*v+y];
 }
 const planeAt=(i,x,y)=>{const [a,b,c]=planes[i];return a*x+b*y+c;};
 function margin(u,v,id){
  const [x,y]=framePoint(u,v,id);
  let j=0;
  while(j<thresholds.length && y>=bank[j+1][1])j++;
  const bankMargin=planeAt(banks[j],x,y);
  const [length,opening,rack,branch]=responses[id];
  const scale=1/(Math.max(length,opening)*(1+Math.abs(rack)));
  const [a,b]=damagePoint(x,y,id,false);
  const walls=planeAt(hingePlane,a,b)<=0?mouthWalls:tipWalls;
  let crackMargin=-Infinity;
  for(const i of walls)crackMargin=Math.max(crackMargin,planeAt(i,a,b));
  if(branch){
   const branchY=branch<0?2*hinge[1]-b:b;
   let branchMargin=-Infinity;
   for(const i of polygons[2])branchMargin=Math.max(branchMargin,planeAt(i,a,branchY));
   crackMargin=Math.min(crackMargin,branchMargin);
  }
  return .6*Math.min(bankMargin,crackMargin*scale);
 }
 const regionCache=new Map();
 function regions(id){
  if(!regionCache.has(id)){
   const [a,b,c,d,x,y]=transforms[id],det=a*d-b*c;
   const unmap=([u,v])=>[(d*(u-x)-b*(v-y))/det,(a*(v-y)-c*(u-x))/det];
   regionCache.set(id,fractures.filter((_,k)=>k!==3||responses[id][3]).map((r,k)=>({
    id:r.id,points:r.points.map(([u,v])=>unmap(k?fromDamage(u,v,id,k===3):[u,v]))
   })));
  }
  return regionCache.get(id);
 }
 function offsets(u,v,id){
  const [x,y]=framePoint(u,v,id),values=new Float32Array(4*localRows);
  // Within the inspector's ±.004 UV window the transformed vertical span is
  // smaller than the closest pair of row cuts. Only the nearest cut can be
  // crossed. Retain residuals about the eye on both adjoining planes.
  let cut=0;
  for(let j=1;j<thresholds.length;j++)if(Math.abs(y-bank[j+1][1])<Math.abs(y-bank[cut+1][1]))cut=j;
  for(let side=0;side<2;side++){
   const i=banks[cut+side];
   values.set([planes[i][0],planes[i][1],planeAt(i,x,y),0],side*4);
  }
  values[3]=y-bank[cut+1][1];
  const crack=damagePoint(x,y,id,false),branch=damagePoint(x,y,id,true);
  for(let i=bankEnd;i<planes.length;i++)values[8+i-bankEnd]=planeAt(i,...(i<branchStart?crack:branch));
  return values;
 }
 const literal=n=>Number(n.toPrecision(14)).toString().replace(/^(-?\d+)$/,'$1.');
 const vector=(a,b)=>'vec2('+literal(a)+','+literal(b)+')';
 const localRows=Math.ceil((8+planes.length-bankEnd)/4);
 // In the most oblique parent frame, bound the vertical change so a ray can
 // never reach a second row cut. This also handles a future narrower bay.
 const minSpacing=Math.min(...thresholds.slice(1).map((_,j)=>bank[j+2][1]-bank[j+1][1]));
 const maxRowChange=Math.max(...transforms.map(t=>Math.abs(t[2])+Math.abs(t[3])));
 const localRadiusUV=Math.min(.004,minSpacing/(2*maxRowChange));
 // Dynamic uniform reads map to a hardware constant buffer. Large literal
 // arrays indexed by a ray's plate id turn into long select chains in ANGLE.
 const frames=new Float32Array(transforms.flatMap(([a,b,c,d])=>[a,b,c,d]));
 const origins=new Float32Array(transforms.flatMap(t=>t.slice(4)));
 const loadsGPU=new Float32Array(responses.flat());
 const bankPlanes=new Float32Array(banks.flatMap(i=>planes[i]));
 const initialized=new WeakSet();
 function upload(gl,u){
  if(initialized.has(u))return;
  const fields=[['uFractureFrame',frames,4],['uFractureOrigin',origins,2],['uFractureLoad',loadsGPU,4],['uFractureBank',bankPlanes,3]];
  for(const [name,data,width] of fields){
   const location=u[name+'[0]'];
   if(location!=null)gl['uniform'+width+'fv'](location,data);
  }
  initialized.add(u);
 }
 function shader(local){
  const plane=i=>{
   const [a,b,c]=planes[i],k=8+i-bankEnd,base=local?'uFracturePlanes['+Math.floor(k/4)+'].'+'xyzw'[k%4]:literal(c);
   const q=i<branchStart?'crack':'branch';
   return '(dot('+vector(a,b)+','+q+')+'+base+')';
  };
  const wedge=group=>group.map(plane).reduce((a,b)=>'max('+a+','+b+')');
  // Each regularly pitched row has one flat segment. Its two neighbours
  // describe the sloped transfers, including the ends of the released bank.
  const bankSelect=local?'vec3 bank=q.y+uFracturePlanes[0].w<0.?uFracturePlanes[0].xyz:uFracturePlanes[1].xyz;':
   'int row=int(clamp(floor((q.y-('+literal(bank[1][1]+rowBelow)+'))/'+literal(rowPitch)+'+.5),0.,'+literal((banks.length-3)/2)+'));'+
   'float lower='+literal(bank[1][1])+'+float(row)*'+literal(rowPitch)+';int segment=2*row+1;'+
   'vec3 bank=uFractureBank[q.y<lower?segment-1:q.y>=lower+'+literal(bank[2][1]-bank[1][1])+'?segment+1:segment];';
  const tear='('+plane(hingePlane)+'<=0.?'+wedge(mouthWalls)+':'+wedge(tipWalls)+')';
  const cracks='min('+tear+',load.w==0.?1e5:'+wedge(polygons[2])+')';
  const origin=vector(root,.12);
  return 'float '+(local?'localStructuralShadeMargin':'structuralShadeMargin')+'(vec2 uv,int id){vec4 frame=uFractureFrame[id];vec2 q=vec2(dot(frame.xy,uv),dot(frame.zw,uv))'+(local?'':'+uFractureOrigin[id]')+
    ';'+bankSelect+'vec4 load=uFractureLoad[id];vec2 d=q'+(local?'':'-'+origin)+';vec2 crack=vec2(d.x,(d.y-load.z*d.x))*load.xy'+(local?'':'+'+origin)+
    ';vec2 branch=crack;if(load.w<0.)branch.y='+(local?'':literal(2*hinge[1]))+'-crack.y;'+
    'return .6*min(dot(bank.xy,q)+bank.z,'+cracks+'/(max(load.x,load.y)*(1.+abs(load.z))));}';
 }
 const globalGLSL='uniform vec4 uFractureFrame[20],uFractureLoad[20];uniform vec2 uFractureOrigin[20];uniform vec3 uFractureBank['+banks.length+'];\n'+shader(false);
 const glsl='uniform vec4 uFracturePlanes['+localRows+'];\n'+globalGLSL+'\n'+shader(true);
 return {margin,regions,offsets,upload,localRadiusUV,glsl,globalGLSL};
}
const shadeFracture=buildShadeFracture();
root.SphereWorld={shadeFracture,defaults,frame,coordinates,direction,sample,palette,names,provinces,fractions,habitatMeridians,smooth,woundMetric,woundDistance,woundGradient,woundBlend,woundPalette,woundBandKm,woundTileKm,edgeBiome,boundaryPoint,nearestRim,rimFrame,locateBiome,physics,shadeSolid,shadeSolidBody};
})(typeof window==='undefined'?globalThis:window);
