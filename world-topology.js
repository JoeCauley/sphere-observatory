/*
 * Infinite Biomes topology and deterministic sampling foundation.
 *
 * This module has no renderer or residency state.  A cell is an integer
 * cube-sphere address and every value is derived from its semantic domain,
 * world seed and canonical point key.  Generation order therefore cannot
 * become part of geographic identity.
 */
(function(root){
'use strict';

const Address=root.SphereWorldAddress||((typeof module!=='undefined'&&module.exports)?require('./world-address.js'):null);
if(!Address)throw Error('World Address v2 is required before world topology');
const MAX_LEVEL=Address.MAX_LEVEL, EDGES=Object.freeze(['north','east','south','west']);
// Every semantic stream is independent.  The original IB-020 domains remain
// first and the IB-040 fields extend the same counter/hash contract.
const DOMAINS=Object.freeze(['elevation','water','route','biome','vegetation','landmark','geology','wetness','catchment','service','damage','exclusion']);
const DOMAIN_SET=new Set(DOMAINS), MASK64=(1n<<64n)-1n;
const FNV_OFFSET=1469598103934665603n,FNV_PRIME=1099511628211n;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const scale=(v,k)=>v.map(x=>x*k);
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const length=v=>Math.hypot(...v);
const normalise=v=>scale(v,1/length(v));
const integer=(v,name,min=0,max=2147483647)=>{if(!Number.isInteger(v)||v<min||v>max)throw Error('Invalid '+name);return v;};
const finite=(v,name)=>{if(!Number.isFinite(v))throw Error('Invalid '+name);return v;};
const levelSize=level=>2**integer(level,'level',0,MAX_LEVEL);
const copyCell=c=>({face:c.face,level:c.level,x:c.x,y:c.y});

function validateCell(input,name='cell'){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid '+name);
 const c={face:integer(input.face,name+'.face',0,5),level:integer(input.level,name+'.level',0,MAX_LEVEL),x:integer(input.x,name+'.x'),y:integer(input.y,name+'.y')};
 const size=levelSize(c.level);if(c.x>=size||c.y>=size)throw Error('Invalid '+name+' coordinates');
 return c;
}

function cellKey(input){const c=validateCell(input);return `c${c.face}.${c.level}.${c.x}.${c.y}`;}
function parseCellKey(key){
 if(typeof key!=='string')throw Error('Invalid cell key');
 const m=/^c([0-5])\.([0-9]+)\.([0-9]+)\.([0-9]+)$/.exec(key);if(!m)throw Error('Invalid cell key');
 return validateCell({face:Number(m[1]),level:Number(m[2]),x:Number(m[3]),y:Number(m[4])},'cell key');
}
function keyOf(input){return typeof input==='string'?input:cellKey(input);}

function pointVector(face,level,ix,iy,resolution=1){
 const f=Address.faces[integer(face,'face',0,5)],size=levelSize(level),r=integer(resolution,'resolution',1,1048576),span=size*r;
 ix=integer(ix,'lattice x',0,span);iy=integer(iy,'lattice y',0,span);
 return add(scale(f.normal,span),add(scale(f.u,-span+2*ix),scale(f.v,-span+2*iy)));
}
function gcd(a,b){while(b){const t=a%b;a=b;b=t;}return a;}
function primitive(v){
 const g=v.reduce((d,n)=>gcd(d,Math.abs(n)),0)||1;
 return v.map(n=>n/g);
}
function pointKey(vector){const p=primitive(vector);return `p${p[0]},${p[1]},${p[2]}`;}
function latticeKey(face,level,ix,iy,resolution=1){return pointKey(pointVector(face,level,ix,iy,resolution));}
function latticeDirection(face,level,ix,iy,resolution=1){return normalise(pointVector(face,level,ix,iy,resolution));}
function cellDirection(input,local=[.5,.5]){
 const c=validateCell(input),f=Address.faces[c.face],size=levelSize(c.level);
 if(!Array.isArray(local)||local.length!==2||!local.every(Number.isFinite)||local.some(v=>v<0||v>1))throw Error('Invalid local coordinates');
 const u=-1+2*(c.x+local[0])/size,v=-1+2*(c.y+local[1])/size;
 return normalise(add(f.normal,add(scale(f.u,u),scale(f.v,v))));
}
function cellAt(direction,level){
 level=integer(level,'level',0,MAX_LEVEL);const g=Address.gridAt(direction,level);return {face:g.face,level:g.level,x:g.x,y:g.y};
}

function outsideDirection(c,edge,t=.5){
 c=validateCell(c);if(!EDGES.includes(edge))throw Error('Invalid edge');finite(t,'edge parameter');if(t<0||t>1)throw Error('Invalid edge parameter');
 const f=Address.faces[c.face],size=levelSize(c.level),u=edge==='west'?-1-1/size:edge==='east'?1+1/size:-1+2*(c.x+t)/size;
 const v=edge==='south'?-1-1/size:edge==='north'?1+1/size:-1+2*(c.y+t)/size;
 return normalise(add(f.normal,add(scale(f.u,u),scale(f.v,v))));
}
function neighbour(c,edge){
 c=validateCell(c);if(!EDGES.includes(edge))throw Error('Invalid edge');const size=levelSize(c.level);
 if(edge==='west'&&c.x>0)return {...c,x:c.x-1};
 if(edge==='east'&&c.x<size-1)return {...c,x:c.x+1};
 if(edge==='south'&&c.y>0)return {...c,y:c.y-1};
 if(edge==='north'&&c.y<size-1)return {...c,y:c.y+1};
 return cellAt(outsideDirection(c,edge,.5),c.level);
}
function neighbors(c){return Object.fromEntries(EDGES.map(edge=>[edge,neighbour(c,edge)]));}
function edgeKey(c,edge){
 c=validateCell(c);if(!EDGES.includes(edge))throw Error('Invalid edge');
 const a=cellKey(c),b=cellKey(neighbour(c,edge));return `e${c.level}:${a<b?a+'|'+b:b+'|'+a}`;
}
function edgeOwner(c,edge){
 c=validateCell(c);const other=neighbour(c,edge),a=cellKey(c),b=cellKey(other),owner=a<b?c:other;
 const ownerEdge=EDGES.find(e=>cellKey(neighbour(owner,e))===(a<b?b:a));
 return {key:edgeKey(c,edge),cell:copyCell(owner),edge:ownerEdge,owner:a===cellKey(owner)};
}

function boundaryLattice(c,edge,index,resolution=1){
 c=validateCell(c);if(!EDGES.includes(edge))throw Error('Invalid edge');
 const r=integer(resolution,'resolution',1,1048576),i=integer(index,'edge sample',0,r);let ix,iy;
 if(edge==='west'||edge==='east'){ix=c.x*r+(edge==='east'?r:0);iy=c.y*r+i;}
 else {ix=c.x*r+i;iy=c.y*r+(edge==='north'?r:0);}
 const vector=pointVector(c.face,c.level,ix,iy,r);
 return {key:pointKey(vector),vector,direction:normalise(vector),face:c.face,level:c.level,ix,iy,resolution:r};
}
function transform(c,edge,t=.5){
 c=validateCell(c);finite(t,'edge parameter');if(t<0||t>1)throw Error('Invalid edge parameter');
 const target=neighbour(c,edge),size=levelSize(c.level);
 if(target.face===c.face){
  const local=edge==='west'?[1,t]:edge==='east'?[0,t]:edge==='south'?[t,1]:[t,0];
  return {face:target.face,level:target.level,x:target.x,y:target.y,local,direction:cellDirection(c,edge==='west'?[0,t]:edge==='east'?[1,t]:edge==='south'?[t,0]:[t,1])};
 }
 const f=Address.faces[c.face];
 const u=edge==='west'?-1:edge==='east'?1:-1+2*(c.x+t)/size;
 const v=edge==='south'?-1:edge==='north'?1:-1+2*(c.y+t)/size;
 const q=normalise(add(f.normal,add(scale(f.u,u),scale(f.v,v)))),tf=Address.faces[target.face];
 const den=Math.abs(q[tf.normal.findIndex(vv=>vv!==0)]),pu=q[tf.u.findIndex(vv=>vv!==0)]/den,pv=q[tf.v.findIndex(vv=>vv!==0)]/den;
 const su=clamp((pu+1)*.5*size,0,size),sv=clamp((pv+1)*.5*size,0,size);
 let x=Math.floor(Math.min(size-1,su)),y=Math.floor(Math.min(size-1,sv));
 // The exact edge belongs to either cell depending on face ownership.  The
 // cell itself is already known from the outward probe, so preserve it when
 // projection lands on the far side of a target boundary.
 if(Math.abs(su-size)<1e-10)x=size-1;if(Math.abs(sv-size)<1e-10)y=size-1;
 x=target.x;y=target.y;
 return {face:target.face,level:target.level,x,y,local:[clamp(su-x,0,1),clamp(sv-y,0,1)],direction:q};
}
function parent(c){c=validateCell(c);if(c.level===0)return copyCell(c);return {face:c.face,level:c.level-1,x:Math.floor(c.x/2),y:Math.floor(c.y/2)};}
function quadrant(c){c=validateCell(c);return [c.x%2,c.y%2];}
function child(c,q){
 c=validateCell(c);if(c.level>=MAX_LEVEL)throw Error('Cell is already at maximum level');if(!Array.isArray(q)||q.length!==2||!q.every(v=>v===0||v===1))throw Error('Invalid child quadrant');
 return {face:c.face,level:c.level+1,x:c.x*2+q[0],y:c.y*2+q[1]};
}
function children(c){return [[0,0],[1,0],[0,1],[1,1]].map(q=>child(c,q));}

function hash64(parts){
 let h=FNV_OFFSET;
 for(const part of parts){const text=String(part);for(let i=0;i<text.length;i++){h^=BigInt(text.charCodeAt(i));h=(h*FNV_PRIME)&MASK64;}h^=255n;h=(h*FNV_PRIME)&MASK64;}
 return h;
}
function domain(name){if(!DOMAIN_SET.has(name))throw Error('Invalid semantic domain');return name;}
function createSampler(options={}){
 const seed=integer(options.worldSeed??0,'world seed'),geography=integer(options.geographyRevision??1,'geography revision'),terrain=integer(options.terrainRevision??1,'terrain revision');
 const prefix=['ib020',seed,geography,terrain];
 const random=(semantic,key,counter=0)=>{domain(semantic);integer(counter,'counter',0,2147483647);const h=hash64([...prefix,semantic,keyOf(key),counter]);return Number(h>>11n)/9007199254740992;};
 const uint32=(semantic,key,counter=0)=>Number(hash64([...prefix,semantic,keyOf(key),counter])&4294967295n)>>>0;
 const samplePoint=(key)=>{
  const k=keyOf(key),e=random('elevation',k),w=random('water',k),route=random('route',k),weights=Array.from({length:10},(_,i)=>.001+random('biome',k,i));
  const total=weights.reduce((a,b)=>a+b,0);return {key:k,elevation:e,water:w,route,biomeWeights:weights.map(v=>v/total)};
 };
 const sampleBoundary=(cell,edge,index,resolution=1)=>{const p=boundaryLattice(cell,edge,index,resolution);return {...p,...samplePoint(p.key)};};
 const sampleCell=(cell,{resolution=1}={})=>{
  cell=validateCell(cell);resolution=integer(resolution,'resolution',1,64);const vertices=[];
  for(let y=0;y<=resolution;y++)for(let x=0;x<=resolution;x++){
   const ix=cell.x*resolution+x,iy=cell.y*resolution+y,vector=pointVector(cell.face,cell.level,ix,iy,resolution),key=pointKey(vector);
   vertices.push({x,y,key,direction:normalise(vector),...samplePoint(key)});
  }
  return {cell:copyCell(cell),key:cellKey(cell),resolution,vertices};
 };
 return Object.freeze({worldSeed:seed,geographyRevision:geography,terrainRevision:terrain,random,uint32,value:random,samplePoint,sampleBoundary,sampleCell});
}

const api={MAX_LEVEL,EDGES,DOMAINS,validateCell,cellKey,parseCellKey,cellAt,cellDirection,latticeKey,latticeDirection,boundaryLattice,neighbour,neighbor:neighbour,neighbors,edgeKey,edgeOwner,transform,parent,quadrant,child,children,hash64,createSampler,sampler:createSampler};
root.SphereWorldTopology=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
