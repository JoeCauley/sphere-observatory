'use strict';
// A geometry-derived, unlit atlas. No external artwork, image editor or AI asset.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const cfg=require('./last-run.json'),root=cfg.runtime;
require(path.join(root,'math.js'));
for(const f of ['collection','biomes','world-palette','biome-packs','world','watershed-network','field-sites','legacy-role-adapter','watershed-province','world-geography','watershed-neighbourhood','meadow-ecology','ground-chunks','meadow-support','meadow-canopy','instanced-environment','grass-stream','meadow-field'])require(path.join(root,f+'.js'));
const F=global.SphereMeadowCanopy,E=global.SphereInstancedEnvironment,p=F.prototypes({meadow:{appearanceRevision:4,appearancePreset:'meadow-proof-f2',canopyRevision:2,materialRevision:3}})[0].lods[0];
const size=[256,128],tile=64,ss=4,colour=new Uint8Array(size[0]*size[1]*4),normal=new Uint8Array(colour.length),data=F.clumpStemData(),views=[],dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
function oct(n){const l=Math.abs(n[0])+Math.abs(n[1])+Math.abs(n[2]);let x=n[0]/l,y=n[1]/l;if(n[2]<0)[x,y]=[(1-Math.abs(y))*Math.sign(x||1),(1-Math.abs(x))*Math.sign(y||1)];return [x*.5+.5,y*.5+.5];}
for(let elevation=0;elevation<2;elevation++)for(let azimuth=0;azimuth<4;azimuth++){
 const a=azimuth*Math.PI/2,e=elevation*70*Math.PI/180,view=[Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)],right=[Math.cos(a),0,-Math.sin(a)],up=cross(view,right),side=tile*ss,depth=new Float32Array(side*side).fill(-Infinity),buffer=new Float32Array(side*side*8),projected=[];
 for(let i=0;i<p.vertices.length;i+=6){
  const xyz=Array.from(p.vertices.subarray(i,i+3)),v=[xyz[0],xyz[1]-.55,xyz[2]],n=Array.from(p.vertices.subarray(i+3,i+6));
  projected.push({x:(dot(v,right)/1.6+.5)*side,y:(dot(v,up)/1.5+.5)*side,z:dot(v,view),height:xyz[1],n});
 }
 for(let k=0;k<p.indices.length;k+=3){
  const ids=Array.from(p.indices.subarray(k,k+3)),[a,b,c]=ids.map(i=>projected[i]),area=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
  if(Math.abs(area)<1e-9)continue;
  const minX=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),maxX=Math.min(side-1,Math.ceil(Math.max(a.x,b.x,c.x))),minY=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),maxY=Math.min(side-1,Math.ceil(Math.max(a.y,b.y,c.y)));
  const stem=Math.floor(ids[0]/16),palette=[[.22,.47,.18],[.31,.58,.22],[.42,.64,.25]][data[stem].colourClass];
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
   const u=((b.y-c.y)*(x+.5-c.x)+(c.x-b.x)*(y+.5-c.y))/area,v=((c.y-a.y)*(x+.5-c.x)+(a.x-c.x)*(y+.5-c.y))/area,w=1-u-v;
   if(u<0||v<0||w<0)continue;
   const z=a.z*u+b.z*v+c.z*w,index=y*side+x;if(z<depth[index])continue;depth[index]=z;
   const n=unit(a.n.map((t,i)=>t*u+b.n[i]*v+c.n[i]*w)),at=index*8;
   buffer.set([...palette,...n,z,(a.height*u+b.height*v+c.height*w)/1.1],at);
  }
 }
 let covered=0;
 for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
  let count=0,values=new Float64Array(8);
  for(let sy=0;sy<ss;sy++)for(let sx=0;sx<ss;sx++){const pixel=(y*ss+sy)*side+x*ss+sx;if(depth[pixel]!==-Infinity){count++;for(let i=0;i<8;i++)values[i]+=buffer[pixel*8+i];}}
  const offset=((elevation*tile+y)*size[0]+azimuth*tile+x)*4;if(!count)continue;covered++;
  for(let i=0;i<8;i++)values[i]/=count;
  const encoded=oct(unit(Array.from(values.subarray(3,6))));
  colour.set([...Array.from(values.subarray(0,3),v=>Math.round(Math.max(0,Math.min(1,v))*255)),Math.round(count/(ss*ss)*255)],offset);
  normal.set([Math.round(encoded[0]*255),Math.round(encoded[1]*255),Math.round((Math.max(-.8,Math.min(.8,values[6]))/.8*.5+.5)*255),Math.round(Math.max(0,Math.min(1,values[7]))*255)],offset);
 }
 views.push({azimuthDegrees:azimuth*90,elevationDegrees:elevation*70,coveredTexels:covered,view,right,up});
}
const atlas=path.join(root,'prototype');fs.mkdirSync(atlas);
const manifest={schema:1,profile:cfg.profile,bake:'CPU orthographic triangle rasterizer; nearest visible surface; 4x4 coverage resolve; unlit colour plus oct-normal/depth/height',sourcePrototypeHash:p.contentHash||F.prototypes({meadow:{appearanceRevision:4,appearancePreset:'meadow-proof-f2',canopyRevision:2,materialRevision:3}})[0].contentHash,sourceVertices:p.vertices.length/6,sourceTriangles:p.indices.length/3,size,tile,views,spanMetres:[1.6,1.5],centreMetres:[0,.55,0],textures:[]};
for(const [name,bytes] of [['colour.rgba',colour],['normal.rgba',normal]]){fs.writeFileSync(path.join(atlas,name),bytes,{flag:'wx'});manifest.textures.push({name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}
fs.writeFileSync(path.join(atlas,'atlas.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
fs.copyFileSync(path.join(__dirname,'canopy-p1.js'),path.join(atlas,'canopy-p1.js'));
fs.writeFileSync(path.join(cfg.evidence,'atlas.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({atlas,size,sourceVertices:manifest.sourceVertices,sourceTriangles:manifest.sourceTriangles,views:views.length}));
