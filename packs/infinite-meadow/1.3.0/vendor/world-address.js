/*
 * World Address v2.
 *
 * This module is deliberately independent of rendering, residency and the
 * current camera frame.  It names a place on the Sphere; it does not decide
 * which representation is resident.
 */
(function(root){
'use strict';

const SCHEMA=2, MAX_LEVEL=30, FACE_COUNT=6;
const DOMAINS=new Set(['waterway','route','district','vegetation','landmark','hero']);
const faces=Object.freeze([
 {name:'+x',normal:[1,0,0],u:[0,0,-1],v:[0,1,0]},
 {name:'-x',normal:[-1,0,0],u:[0,0,1],v:[0,1,0]},
 {name:'+y',normal:[0,1,0],u:[1,0,0],v:[0,0,-1]},
 {name:'-y',normal:[0,-1,0],u:[1,0,0],v:[0,0,1]},
 {name:'+z',normal:[0,0,1],u:[1,0,0],v:[0,1,0]},
 {name:'-z',normal:[0,0,-1],u:[-1,0,0],v:[0,1,0]}
]);
const fields=['schema','worldSeed','geographyRevision','terrainRevision','artRevision','assetRevision','heroRevision','space','face','level','x','y','local'];
const parentFields=['face','level','x','y','local'];
const number=(v,name)=>{if(!Number.isFinite(v))throw Error('Invalid '+name);return v;};
const integer=(v,name,min=0,max=2147483647)=>{if(!Number.isInteger(v)||v<min||v>max)throw Error('Invalid '+name);return v;};
const vector=(v,name)=>{if(!Array.isArray(v)||v.length!==2||!v.every(Number.isFinite))throw Error('Invalid '+name);return v.slice();};
const unit=(v,name)=>{if(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))throw Error('Invalid '+name);const length=Math.hypot(...v);if(!length||Math.abs(length-1)>1e-10)throw Error('Invalid '+name);return v.map(x=>x/length);};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const scale=(a,k)=>a.map(v=>v*k);
const norm=v=>{const l=Math.hypot(...v);return scale(v,1/l);};
const directionVector=v=>{if(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite)||!Math.hypot(...v))throw Error('Invalid direction');return norm(v);};
const levelSize=level=>2**level;
const localValue=v=>number(v,'local coordinate');

function validateGrid(grid,name='address'){
 if(!grid||typeof grid!=='object'||Array.isArray(grid))throw Error('Invalid '+name);
 grid={face:integer(grid.face,name+'.face',0,FACE_COUNT-1),level:integer(grid.level,name+'.level',0,MAX_LEVEL),x:integer(grid.x,name+'.x'),y:integer(grid.y,name+'.y'),local:vector(grid.local,name+'.local')};
 const size=levelSize(grid.level);if(grid.x>=size||grid.y>=size)throw Error('Invalid '+name+' cell coordinates');
 if(grid.local.some(v=>v<0||v>1))throw Error('Invalid '+name+' local coordinates');
 return grid;
}
function copyGrid(grid){return {face:grid.face,level:grid.level,x:grid.x,y:grid.y,local:grid.local.slice()};}
function gridKey(grid){const g=validateGrid(grid);return [g.face,g.level,g.x,g.y,g.local[0],g.local[1]].join('/');}

function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid World Address');
 if(input.schema!==SCHEMA)throw Error('Unsupported World Address schema');
 const a={schema:SCHEMA,
  worldSeed:integer(input.worldSeed,'world seed'),
  geographyRevision:integer(input.geographyRevision,'geography revision'),
  terrainRevision:integer(input.terrainRevision,'terrain revision'),
  artRevision:integer(input.artRevision,'art revision'),
  assetRevision:integer(input.assetRevision,'asset revision'),
  heroRevision:input.heroRevision===null?null:integer(input.heroRevision,'Hero Zone revision'),
  space:input.space,
  face:input.face,level:input.level,x:input.x,y:input.y,local:input.local
 };
 if(a.space!=='shell'&&a.space!=='shade')throw Error('Invalid World Address space');
 Object.assign(a,validateGrid(a,'World Address'));
 if(a.space==='shade'){
  if(!Number.isInteger(input.shadeId)||input.shadeId<0||input.shadeId>2147483647)throw Error('Invalid Shade ID');
  a.shadeId=input.shadeId;
  a.parent=validateGrid(input.parent,'Shade parent address');
 }
 return a;
}

function create(input){
 const a=validate({...input,schema:SCHEMA});
 // Rebuild in the documented field order so serialization is canonical even
 // when callers supplied fields in a different order.
 const out={schema:SCHEMA,worldSeed:a.worldSeed,geographyRevision:a.geographyRevision,terrainRevision:a.terrainRevision,artRevision:a.artRevision,assetRevision:a.assetRevision,heroRevision:a.heroRevision,space:a.space,face:a.face,level:a.level,x:a.x,y:a.y,local:a.local.slice()};
 if(a.space==='shade'){out.shadeId=a.shadeId;out.parent=copyGrid(a.parent);}
 if(input.legacyPack){
  const legacy=input.legacyPack;if(typeof legacy!=='object'||legacy.schema!==1||legacy.packId!=='watershed'||legacy.geographyRevision!==1||![1,2].includes(legacy.artRevision)||!Number.isInteger(legacy.seed)||legacy.seed<0)throw Error('Invalid legacy pack provenance');
  unit(legacy.anchor,'legacy pack anchor');
  out.legacyPack={schema:1,packId:'watershed',geographyRevision:legacy.geographyRevision,artRevision:legacy.artRevision,seed:legacy.seed,anchor:legacy.anchor.slice()};
 }
 return out;
}

function stringify(address){
 const a=create(address);return JSON.stringify(a);
}
function parse(raw){
 if(typeof raw!=='string'||raw.length>10000)throw Error('Invalid serialized World Address');
 try{return create(JSON.parse(raw));}catch(error){throw Error('Invalid serialized World Address: '+error.message);}
}
function equal(a,b){return stringify(a)===stringify(b);}

function faceFor(q){
 const values=q.map(Math.abs),max=Math.max(...values);
 // Face order is part of the contract: ties belong to the first matching
 // signed axis, making exact cube edges and corners canonical.
 if(values[0]===max)return q[0]>=0?0:1;
 if(values[1]===max)return q[1]>=0?2:3;
 return q[2]>=0?4:5;
}
function project(q,face){
 const f=faces[face],den=Math.abs(q[f.normal.findIndex(v=>v!==0)]);
 return {u:dot(q,f.u)/den,v:dot(q,f.v)/den};
}
function gridAt(direction,level){
 const q=directionVector(direction),face=faceFor(q),p=project(q,face),size=levelSize(level);
 const axis=v=>{const scaled=clamp((v+1)*.5*size,0,size);if(scaled>=size)return {cell:size-1,local:1};const cell=Math.floor(scaled);return {cell,local:scaled-cell};};
 const u=axis(p.u),v=axis(p.v);return {face,level,x:u.cell,y:v.cell,local:[u.local,v.local]};
}
function direction(grid){
 const g=validateGrid(grid),f=faces[g.face],size=levelSize(g.level),u=-1+2*(g.x+g.local[0])/size,v=-1+2*(g.y+g.local[1])/size;
 return norm(add(f.normal,add(scale(f.u,u),scale(f.v,v))));
}
function shell(input){
 const metadata={worldSeed:input.worldSeed,geographyRevision:input.geographyRevision,terrainRevision:input.terrainRevision,artRevision:input.artRevision,assetRevision:input.assetRevision,heroRevision:input.heroRevision??null};
 return create({...metadata,space:'shell',...gridAt(input.direction,input.level??12)});
}
function shade(input){
 const metadata={worldSeed:input.worldSeed,geographyRevision:input.geographyRevision,terrainRevision:input.terrainRevision,artRevision:input.artRevision,assetRevision:input.assetRevision,heroRevision:input.heroRevision??null};
 return create({...metadata,space:'shade',shadeId:integer(input.shadeId,'Shade ID'),parent:validateGrid(input.parent,'Shade parent address'),...gridAt(input.direction,input.level??12)});
}
function parent(address){
 const a=create(address);if(a.level===0)return a;
 const g={face:a.face,level:a.level-1,x:Math.floor(a.x/2),y:Math.floor(a.y/2),local:[(a.x%2+a.local[0])*.5,(a.y%2+a.local[1])*.5]};
 return a.space==='shell'?create({...a,...g}):create({...a,...g});
}
function child(address,quadrant){
 const a=create(address),q=Array.isArray(quadrant)?quadrant:[quadrant?.x,quadrant?.y];
 if(!q||q.length!==2||!q.every(v=>v===0||v===1))throw Error('Invalid child quadrant');
 if(a.level>=MAX_LEVEL)throw Error('World Address is already at maximum level');
 const g={face:a.face,level:a.level+1,x:a.x*2+q[0],y:a.y*2+q[1],local:[a.local[0]*2-q[0],a.local[1]*2-q[1]]};
 if(g.local.some(v=>v<0||v>1))throw Error('Child quadrant does not contain address');
 return a.space==='shell'?create({...a,...g}):create({...a,...g,parent:a.parent&&copyGrid(a.parent)});
}
function quadrant(address){const a=create(address);return [a.x%2,a.y%2];}
function legacyPack(address,options={}){
 if(!address||typeof address!=='object'||address.schema!==1||address.packId!=='watershed'||address.geographyRevision!==1||![1,2].includes(address.artRevision))throw Error('Unsupported schema-1 pack address');
 const anchor=unit(address.anchor,'legacy pack anchor'),a=shell({worldSeed:address.seed,geographyRevision:address.geographyRevision,terrainRevision:options.terrainRevision??2,artRevision:address.artRevision,assetRevision:options.assetRevision??1,heroRevision:null,direction:anchor,level:options.level??12});
 a.legacyPack={schema:1,packId:'watershed',geographyRevision:1,artRevision:address.artRevision,seed:address.seed,anchor:address.anchor.slice()};
 return a;
}
function toLegacyPack(address){
 const a=create(address);if(a.space!=='shell'||!a.legacyPack)throw Error('World Address has no schema-1 pack provenance');
 return {...a.legacyPack,anchor:a.legacyPack.anchor.slice()};
}
function featureId(domain,address,localId='0'){
 if(!DOMAINS.has(domain))throw Error('Invalid feature domain');if(typeof localId!=='string'||!/^[A-Za-z0-9._~-]{1,80}$/.test(localId))throw Error('Invalid feature identifier');
 const a=create(address),base=a.space==='shell'?`s${a.face}.${a.level}.${a.x}.${a.y}`:`h${a.shadeId}.${a.face}.${a.level}.${a.x}.${a.y}`;
 return `${domain}:${a.worldSeed}:${a.geographyRevision}:${base}:${localId}`;
}
function withoutLegacy(address){const a=create(address);delete a.legacyPack;return a;}

const api={SCHEMA,MAX_LEVEL,faces,domains:[...DOMAINS],validate,create,stringify,parse,equal,faceFor,gridAt,direction,shell,shade,parent,child,quadrant,legacyPack,toLegacyPack,featureId,withoutLegacy,gridKey};
root.SphereWorldAddress=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
