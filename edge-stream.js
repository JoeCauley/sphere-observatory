/* Persistent, camera-following edge detail. Distances are km; LOD errors are output pixels. */
(function(root){
'use strict';
const M=root.SphereMath,W=root.SphereWorld,C=root.SphereCollection,S=root.SphereSites;
const {add,sub,mul,dot,cross,norm,length:len}=M,TAU=Math.PI*2;
let width=1920,revision=0,captureMode=false;
const meshes=new Map(),frames=new Map(),levels=new Map();let cachedVertices=0;
function setView(w,{deterministic=false}={}){w=Math.max(320,Math.min(16384,w));if(width!==w||captureMode!==deterministic){width=w;captureMode=deterministic;revision++;}}
function focal(s){return width/(2*Math.tan(M.radians(s.fov)*.5));}
function readableRange(size,s,pixels=.45){return size*focal(s)/pixels;}
function remember(key,build){let mesh=meshes.get(key);if(!mesh){mesh=build();mesh.streamKey=key;meshes.set(key,mesh);cachedVertices+=mesh.count;}else{meshes.delete(key);meshes.set(key,mesh);}while(meshes.size>1200||cachedVertices>3000000){const oldest=meshes.keys().next().value;cachedVertices-=meshes.get(oldest).count;meshes.delete(oldest);}return mesh;}
function distanceToSegment(p,a,b){const v=sub(b,a),t=M.clamp(dot(sub(p,a),v)/Math.max(1e-20,dot(v,v)),0,1);return len(sub(p,add(a,mul(v,t))));}
function rimContext(s){
 if(s.layoutVersion!==2||!s.collection||s.era!=='after'||!s.multipleWounds)return null;
 const alt=Math.abs(s.radius-len(s.position)),limit=Math.max(5000,readableRange(s.shellThickness,s)*1.2);if(alt>limit)return null;
 const key=JSON.stringify([s.position,s.radius,s.shellThickness,revision]);if(frames.has(key))return frames.get(key);
 const near=W.nearestRim(norm(s.position),s);
 if(Math.hypot(near.distance,alt)>limit){frames.set(key,null);while(frames.size>8)frames.delete(frames.keys().next().value);return null;}
 const f=W.rimFrame(s,near.index,near.t),w=C.wounds[near.index],origin=mul(f.point,s.radius),basis=[f.tangent,mul(f.point,-1),f.inland];
 const a=w.length*Math.cos(near.t),j=1+.13*Math.sin(a*71)+.055*Math.sin(a*193),b=w.width*j*Math.sin(near.t);
 const result={...near,...f,origin,basis,a,b,j,w};frames.set(key,result);while(frames.size>8)frames.delete(frames.keys().next().value);return result;
}
// This incremental implicit ellipse is also evaluated in the fragment shader.
// Subtracting two AU-sized float positions (or two almost-equal metrics) loses the edge.
function rimMargin(local,ctx,s){
 const dq=mul(local,1/s.radius),A=dot(ctx.point,ctx.w.axis),B=dot(ctx.point,ctx.w.tangent),U=dot(ctx.point,cross(ctx.w.axis,ctx.w.tangent));
 const da0=dot(dq,ctx.w.axis),db0=dot(dq,ctx.w.tangent),du=dot(dq,cross(ctx.w.axis,ctx.w.tangent));
 const da=Math.atan2(A*db0-B*da0,A*(A+da0)+B*(B+db0)),c=Math.cos(ctx.b),dc=-(2*U*du+du*du)/(Math.sqrt(Math.max(0,1-(U+du)**2))+c);
 const db=Math.atan2(c*du-U*dc,1+U*du+c*dc),dj=.26*Math.cos(ctx.a*71+da*35.5)*Math.sin(da*35.5)+.11*Math.cos(ctx.a*193+da*96.5)*Math.sin(da*96.5);
 const v=ctx.b/ctx.j,dv=(db*ctx.j-ctx.b*dj)/(ctx.j*(ctx.j+dj));
 return (2*ctx.a*da+da*da)/ctx.w.length**2+(2*v*dv+dv*dv)/ctx.w.width**2;
}
const strata=[0,.025,.08,.18,.34,.52,.71,.87,1],rock=[[.14,.126,.098],[.08,.085,.087],[.055,.065,.069],[.10,.084,.06],[.042,.050,.055],[.10,.106,.11],[.055,.065,.071],[.105,.108,.105]];
function rimPoint(s,index,t,depth){
 const f=W.rimFrame(s,index,t),arc=s.radius*.13;
 // Alternating recesses produce sloping torn faces; the top is precisely the shell boundary.
 const retreat=Math.sin(depth/s.shellThickness*Math.PI)*Math.min(.6,s.shellThickness*.07)*(.18+.82*S.noise(Math.cos(t)*arc*.35,Math.sin(t)*arc*.35+depth*.6,s.seed+index));
 return mul(norm(add(f.point,mul(f.inland,-retreat/s.radius))),s.radius+depth);
}
function rimMeshes(s){
 const ctx=rimContext(s);if(!ctx)return [];
 const out=[],fp=focal(s),range=readableRange(s.shellThickness,s),config=JSON.stringify([ctx.index,s.radius,s.shellThickness,s.seed]);
 function visit(a,b,key,depth){
  const pa=mul(W.boundaryPoint(ctx.index,a),s.radius),pb=mul(W.boundaryPoint(ctx.index,b),s.radius),m=(a+b)/2,pm=mul(W.boundaryPoint(ctx.index,m),s.radius);
  const error=len(sub(pm,mul(add(pa,pb),.5))),distance=Math.max(.01,distanceToSegment(s.position,pa,pb)-error-s.shellThickness),span=len(sub(pa,pb));
  if(distance>range*1.12)return;
  // Reserve error for each of the four chords in a leaf, and resolve the damaged relief only nearby.
  const close=distance<readableRange(.6,s),needsRelief=close&&span/4>Math.max(.10,distance/fp*32);
  if(depth<24&&(error*fp/Math.max(.01,distance)>2.8||span>Math.max(2,distance)*1.8||needsRelief)){
   visit(a,m,key+'0',depth+1);visit(m,b,key+'1',depth+1);return;
  }
  const mesh=remember('rim:'+config+':'+key,()=>{
   const f=W.rimFrame(s,ctx.index,m),mesh=new S.Mesh(mul(f.point,s.radius),[f.tangent,mul(f.point,-1),f.inland],'Wound · fractured shell edge');
   for(let j=0;j<4;j++){const t0=a+(b-a)*j/4,t1=a+(b-a)*(j+1)/4;
    for(let k=0;k<strata.length-1;k++)mesh.quad(...[[t0,strata[k]],[t1,strata[k]],[t1,strata[k+1]],[t0,strata[k+1]]].map(([t,d])=>mesh.local(rimPoint(s,ctx.index,t,d*s.shellThickness))),rock[k],-3);
   }
   mesh.detailFeature=s.shellThickness;mesh.rim={index:ctx.index,t:m,span:span/2,a,b};const w=C.wounds[ctx.index];mesh.materialFrame=[w.tangent,mul(w.axis,-1),cross(w.tangent,mul(w.axis,-1))];return mesh.finish({deferBVH:true});
  });out.push(mesh);
 }
 // Fixed dyadic addresses retain buffers and seed placement as the camera travels.
 for(let j=0;j<256;j++)visit(j*TAU/256,(j+1)*TAU/256,String(j)+':',0);
 // Small structural members retire while subpixel; the wall itself extends much farther.
 const ribRange=readableRange(.035,s),derivative=len(sub(W.boundaryPoint(ctx.index,ctx.t+1e-7),W.boundaryPoint(ctx.index,ctx.t-1e-7)))*s.radius/2e-7;
 if(Math.hypot(ctx.distance,Math.abs(s.radius-len(s.position)))<ribRange){
  const pitch=.5,step=pitch/(s.radius*.13),centre=Math.floor(ctx.t/step),count=Math.min(800,Math.ceil(ribRange/(derivative*step)));
  for(let j=Math.floor((centre-count)/8)*8;j<=centre+count;j+=8){
   const t=(j+4)*step,p=mul(W.boundaryPoint(ctx.index,t),s.radius);if(len(sub(s.position,p))>ribRange+s.shellThickness)continue;
   const mesh=remember('rib:'+config+':'+j,()=>{
    const f=W.rimFrame(s,ctx.index,t),mesh=new S.Mesh(p,[f.tangent,mul(f.point,-1),f.inland],'Wound · torn structural ribs');
    for(let r=0;r<8;r++)for(let k=0;k<8;k++){const t=(j+r+.5)*step,d=(k+.4+S.noise(j+r,k,s.seed)*.35)*s.shellThickness/8,rootPoint=mesh.local(rimPoint(s,ctx.index,t,d)),reach=.06+S.noise(j+r,k+12,s.seed)*.25;
     mesh.beam(add(rootPoint,[0,.025,.035]),add(rootPoint,[.07,-.09,-reach]),.035,[.065,.069,.066]);
    }mesh.detailFeature=.035;return mesh.finish({deferBVH:true});
   });out.push(mesh);
  }
 }
 return out;
}
function plateFor(s){return s.siteId?.startsWith('shade-')?C.plates(s).find(p=>p.id===Number(s.siteId.slice(6))):null;}
function crack(v){return -.27-.065*Math.sin(v*11)-.018*Math.sin(v*41)+.013;}
function plateVector(v,p){return add(add(mul(p.right,v[0]),mul(p.normal,v[1])),mul(p.up,v[2]));}
function canonicalPoint(s,p,u,v){const r=len(p.center)*s.radius,point=[u*p.size*(p.across||1)*s.radius,r,v*p.size*s.radius];return p.shape==='cap'||p.shape==='trimmed'?mul(norm(point),r):point;}
function canonicalFrame(s,p,v=0){
 const u=crack(v),origin=canonicalPoint(s,p,u,v),up=p.shape==='cap'||p.shape==='trimmed'?mul(norm(origin),-1):[0,-1,0];
 const eps=1e-7,tangent=norm(sub(canonicalPoint(s,p,crack(v+eps),v+eps),canonicalPoint(s,p,crack(v-eps),v-eps))),inland=norm(cross(up,tangent));
 // Positive local x always points into the surviving bank of the longitudinal fracture.
 const x=inland[0]>0?inland:mul(inland,-1);return {origin,basis:[x,up,norm(cross(x,up))],v,u};
}
function transformMesh(mesh,p){mesh.origin=plateVector(mesh.canonicalOrigin,p);mesh.basis=mesh.canonicalBasis.map(v=>plateVector(v,p));mesh.plate=p;return mesh;}
function shadeSection(s){const p=plateFor(s);if(!p)return null;const f=canonicalFrame(s,p,0),mesh=new S.Mesh(plateVector(f.origin,p),f.basis.map(v=>plateVector(v,p)),'Shade · exposed service structure');mesh.plate=p;return mesh;}
function shadeContext(s){
 const p=plateFor(s);if(!p)return null;const pos=[dot(s.position,p.right),dot(s.position,p.normal),dot(s.position,p.up)],r=len(p.center)*s.radius;
 const v=(p.shape==='cap'||p.shape==='trimmed'?pos[2]*r/pos[1]:pos[2])/(p.size*s.radius),f=canonicalFrame(s,p,M.clamp(v,-.85,.85));
 return {...f,plate:p,position:pos,origin:plateVector(f.origin,p),canonicalOrigin:f.origin,basis:f.basis.map(v=>plateVector(v,p)),r};
}
function shadeMeshes(s){
 const ctx=shadeContext(s);if(!ctx)return [];const p=ctx.plate,fp=focal(s),out=[],range=readableRange(.18,s),cam=ctx.position;
 const config=JSON.stringify([p.id,s.era,s.radius,s.seed,p.shape,p.across,s.shadeTrim]);
 const step=3.2/(p.size*s.radius),centre=Math.floor(ctx.v/step),canonical=canonicalFrame(s,p,ctx.v),slope=len(sub(canonicalPoint(s,p,crack(ctx.v+step),ctx.v+step),canonical.origin))/3.2;
 const count=Math.min(900,Math.ceil(range/(3.2*slope))),damaged=p.damage>0;
 if(distanceToSegment(cam,canonical.origin,add(canonical.origin,mul(canonical.basis[0],3)))>range+3)return [];
 for(let j=centre-count;j<=centre+count;j++){
  const v=(j+.5)*step;if(Math.abs(v)>.86||(p.damage&&!W.shadeSolid(crack(v)+1e-5,v,p.id)))continue;const f=canonicalFrame(s,p,v),distance=distanceToSegment(cam,f.origin,add(f.origin,mul(f.basis[0],3)));
  if(distance>range+2)continue;
  // Only individual panels/braces need the finer level. The continuous analytic skin never ends.
  const levelKey=config+':'+j,score=.035*fp/Math.max(.001,distance),fine=score>(captureMode?1:levels.get(levelKey)? .8:1.2),lod=fine?'near':'far';if(!captureMode)levels.set(levelKey,fine);while(levels.size>1200)levels.delete(levels.keys().next().value);
  const mesh=remember('shade:'+config+':'+j+':'+lod,()=>{
   const mesh=new S.Mesh(f.origin,f.basis,'Shade · exposed service structure');mesh.canonicalOrigin=f.origin;mesh.canonicalBasis=f.basis;
   const at=(x,y,t)=>{const fr=canonicalFrame(s,p,t),q=add(add(fr.origin,mul(fr.basis[0],x)),mul(fr.basis[1],y));return f.basis.map(b=>dot(sub(q,f.origin),b));};
   const edgeAt=t=>damaged?.012+.043*S.noise(t/step*32,2,s.seed):0;
   const n=fine?32:2,columns=fine?18:1,pitch=fine?.10:1.8;
   for(let z=0;z<n;z++){
    const t0=(j+z/n)*step,t1=(j+(z+1)/n)*step,seed=j*13+z;
    for(let x=0;x<columns;x++){
     const x0=x*pitch,x1=(x+1)*pitch,edge=x===0?edgeAt(t0):0,edge1=x===0?edgeAt(t1):0;
     // Taper deck lift and side walls before meeting the analytic skin inland.
     const h=x=>.012*(1-W.smooth(.65,1.8,x));
     const a=at(x0+edge,h(x0),t0),b=at(x1,h(x1),t0),c=at(x1,h(x1),t1),d=at(x0+edge1,h(x0),t1);
     mesh.quad(a,b,c,d,W.palette[13],13);
     if(fine&&x<10){const inset=.006;mesh.quad(a,at(x0+edge,-.025,t0),at(x1-inset,-.025,t0),b,[.04,.047,.05],-4);}
    }
    if(damaged){const a=at(edgeAt(t0),.012,t0),b=at(edgeAt(t1),.012,t1),c=at(edgeAt(t1)+.015,-.026,t1),d=at(edgeAt(t0)+.015,-.026,t0);mesh.quad(a,b,c,d,[.065,.072,.08],-4);mesh.quad(at(0,-.165,t0),at(0,-.165,t1),at(0,-.18,t1),at(0,-.18,t0),[.075,.08,.085],-4);}
    mesh.quad(at(0,-.18,t0),at(1.8,0,t0),at(1.8,0,t1),at(0,-.18,t1),W.palette[14],14);
    if(fine){mesh.beam(at(.16,-.028,t0),at(.16,-.168,t0),.016,[.075,.082,.085]);for(let x=0;x<6;x++){
     const a=at(x*.3+.035,-.025,t0),b=at(x*.3+.33,-.17,t0);mesh.beam(a,b,.008,[.06,.072,.08]);
     mesh.beam(at(x*.3+.035,-.17,t0),at(x*.3+.33,-.025,t0),.008,[.06,.072,.08]);
    }if(damaged)mesh.beam(at(.08,-.15,t0),at(-.05-S.noise(seed,7,s.seed)*.15,-.08,t0),.018,[.15,.12,.075]);}
   }
   mesh.detailFeature=.18;mesh.lod=lod;mesh.shadeRange=[j*step,(j+1)*step];return mesh.finish({deferBVH:true});
  });out.push(transformMesh(mesh,p));
 }
 return out;
}
root.SphereEdges={setView,focal,readableRange,rimContext,rimMargin,rimPoint,rimMeshes,shadeSection,shadeContext,shadeMeshes,plateFor,canonicalPoint,canonicalFrame,plateVector,crack,get revision(){return revision;},get cacheSize(){return meshes.size;},get cacheVertexMiB(){return cachedVertices*44/1048576;}};
})(typeof window==='undefined'?globalThis:window);
