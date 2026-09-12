/* Deterministic local geometry, shared by rendering, ray picking and walking. Units: km. */
(function(root){
'use strict';const M=root.SphereMath,W=root.SphereWorld,C=root.SphereCollection;
const add=M.add,sub=M.sub,mul=M.mul,dot=M.dot,cross=M.cross,norm=M.norm;
const SITE_RADIUS=1.2,GRID=96,EYE=.0017;
function random(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;};}
function noise(x,z,seed){const hash=(a,b)=>{let h=Math.imul(a^seed,374761393)^Math.imul(b,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);return (hash(ix,iz)*(1-u)+hash(ix+1,iz)*u)*(1-v)+(hash(ix,iz+1)*(1-u)+hash(ix+1,iz+1)*u)*v;}
function height(x,z,id,seed){const taper=1-W.smooth(.88,1.2,Math.max(Math.abs(x),Math.abs(z))),n=noise(x*5,z*5,seed),f=noise(x*18,z*18,seed+9);let h=.003;
 if(id===2)h=.012+.024*(.5+.5*Math.sin(x*18+Math.sin(z*8)*1.4))**2+.012*n;
 else if(id===3)h=.004+.040*(1-Math.abs(n*2-1))**3+.008*f;
 else if(id===4||id===5||id>=10)h=.0015+.002*n;
 else if(id===6||id===7)h=.001+.015*W.smooth(.40,.75,n)+.003*f;
 else if(id===9)h=.004+.018*Math.floor(n*6)/6+.002*f;
 else h=.002+.010*n+.004*f;
 // Flatten the landing clearing; it is part of the terrain definition, not a camera offset.
 const landing=[.010,.011,.032,.038,.003,.004,.011,.012,.010,.018][id]??.004;
 h=landing+(h-landing)*W.smooth(.025,.060,Math.hypot(x,z));return h*taper;
}
class Mesh{
 constructor(origin,basis,name='Geometry'){this.origin=origin;this.basis=basis;this.name=name;this.data=[];this.boxes=[];this.triangles=[];}
 tri(a,b,c,color,material=-1,emission=0){let n=norm(cross(sub(b,a),sub(c,a)));if(M.length(n)<.5)return;for(const p of [a,b,c])this.data.push(...p,...n,...color,material,emission);this.triangles.push([a,b,c]);}
 quad(a,b,c,d,color,material=-1,emission=0){this.tri(a,b,c,color,material,emission);this.tri(a,c,d,color,material,emission);}
 box(center,size,color,angle=0,collision=true,emission=0,material=-1){const c=Math.cos(angle),s=Math.sin(angle),p=(x,y,z)=>[center[0]+c*x-s*z,center[1]+y,center[2]+s*x+c*z],x=size[0]/2,y=size[1]/2,z=size[2]/2;
  const q=[p(-x,-y,-z),p(x,-y,-z),p(x,y,-z),p(-x,y,-z),p(-x,-y,z),p(x,-y,z),p(x,y,z),p(-x,y,z)];
  const faces=[[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]];
  faces.forEach((f,j)=>this.quad(...f.map(i=>q[i]),color,Array.isArray(material)?material[j]:material,emission));
  if(collision)this.boxes.push({center:center.slice(),half:mul(size,.5),angle});
 }
 beam(a,b,width,color){const direction=norm(sub(b,a)),x=mul(M.basis(direction).r,width*.5),z=mul(norm(cross(direction,x)),width*.5),corners=p=>[sub(sub(p,x),z),add(sub(p,z),x),add(add(p,x),z),add(sub(p,x),z)],q=[...corners(a),...corners(b)];for(const f of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])this.quad(...f.map(i=>q[i]),color);}
 cone(center,radius,h,color,sides=7,topRadius=0){for(let j=0;j<sides;j++){const a=j*2*Math.PI/sides,b=(j+1)*2*Math.PI/sides;this.quad(add(center,[Math.cos(a)*radius,0,Math.sin(a)*radius]),add(center,[Math.cos(b)*radius,0,Math.sin(b)*radius]),add(center,[Math.cos(b)*topRadius,h,Math.sin(b)*topRadius]),add(center,[Math.cos(a)*topRadius,h,Math.sin(a)*topRadius]),color);} }
 finish({deferBVH=false}={}){this.vertices=new Float32Array(this.data);this.data=null;this.count=this.vertices.length/11;if(deferBVH){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const t of this.triangles)for(const p of t)for(let j=0;j<3;j++){min[j]=Math.min(min[j],p[j]);max[j]=Math.max(max[j],p[j]);}this.bvh={min,max,lazyTriangles:this.triangles};}else this.bvh=buildBVH(this.triangles);return this;}
 local(world){const d=sub(world,this.origin);return this.basis.map(v=>dot(d,v));}
 world(local){return add(this.origin,this.basis.reduce((p,b,i)=>add(p,mul(b,local[i])),[0,0,0]));}
}
function shellFrame(q){const up=mul(q,-1),east=M.basis(up).r;return [east,up,cross(east,up)];}
function terrain(mesh,id,s){const step=SITE_RADIUS*2/GRID,heights=new Float64Array((GRID+1)**2);for(let z=0;z<=GRID;z++)for(let x=0;x<=GRID;x++)heights[z*(GRID+1)+x]=height(x*step-SITE_RADIUS,z*step-SITE_RADIUS,id,s.seed);
 mesh.ground={heights,step,id};const p=(x,z)=>[x*step-SITE_RADIUS,heights[z*(GRID+1)+x],z*step-SITE_RADIUS];
 for(let z=0;z<GRID;z++)for(let x=0;x<GRID;x++){const a=p(x,z),b=p(x+1,z),c=p(x+1,z+1),d=p(x,z+1);mesh.tri(a,c,b,[1,1,1],id);mesh.tri(a,d,c,[1,1,1],id);}
}
function ground(mesh,x,z){if(!mesh.ground)return 0;const {step,heights}=mesh.ground,gx=(x+SITE_RADIUS)/step,gz=(z+SITE_RADIUS)/step,ix=Math.floor(gx),iz=Math.floor(gz);if(ix<0||iz<0||ix>=GRID||iz>=GRID)return 0;const u=gx-ix,v=gz-iz,a=heights[iz*(GRID+1)+ix],b=heights[iz*(GRID+1)+ix+1],c=heights[(iz+1)*(GRID+1)+ix+1],d=heights[(iz+1)*(GRID+1)+ix];return u>=v?a+(b-a)*u+(c-b)*v:a+(c-d)*u+(d-a)*v;}
function populate(mesh,id,s){const rnd=random(s.seed*8191+id*977),colour=W.palette[id];
 for(let i=0;i<320;i++){const x=(rnd()*2-1)*1.08,z=(rnd()*2-1)*1.08;if(Math.hypot(x,z)<.055)continue;const y=ground(mesh,x,z),r=.003+rnd()*.009,h=.008+rnd()*.036,a=rnd()*Math.PI*2,variation=.6+rnd()*.6,c=colour.map(v=>v*variation);
  if(id===0||id===1){const tall=id===1?2.3:1;mesh.box([x,y+h*tall*.35,z],[r*.32,h*tall*.7,r*.32],[.07,.042,.023],a,true);mesh.cone([x,y+h*tall*.30,z],r*(id===1?2.2:1),h*tall,c,8,id===1?r*.65:0);if(id===1)mesh.cone([x,y+h*tall*.55,z],r*1.6,h*.5,c.map(v=>v*1.3),8,r*.3);}
  else if(id===4){const w=.005+rnd()*.024;mesh.box([x,y+h*.22,z],[w,h*.45,w*.6],c,a,true);if(i%3===0){mesh.box([x,y+h*.56,z],[w*.12,h*.8,w*.12],[.095,.092,.085],a,true);mesh.box([x,y+h*.95,z],[w*1.5,w*.12,w*.12],[.12,.10,.08],a,false);}}
  else if(id===5||id>=10){const w=.009+rnd()*.018;mesh.box([x,y+h*.5,z],[w,h,w],c,0,true);mesh.box([x,y+h+.0008,z],[w*.8,.0016,w*.8],c.map(v=>v*.45),0,false);if(i%4===0)mesh.box([x,y+h+.0018,z],[w*.8,.0004,.0005],[.8,.31,.035],0,false,.12);}
  else if(id===8){mesh.cone([x,y,z],r*.18,h,[.055,.11,.10],7,r*.13);mesh.cone([x,y+h*.72,z],r*1.6,h*.14,[.08,.22,.19],10,r*.7);mesh.cone([x,y+h*.86,z],r*.7,h*.17,c.map(v=>v*1.5),10,0);mesh.box([x,y+h*.25,z],[r*.35,h*.5,r*.35],[.04,.13,.12],a,true);}
  else if(id===9){mesh.cone([x,y,z],r,h*2,[.21,.09,.29],6,r*.75);mesh.cone([x,y+h*2,z],r*.75,h*.55,[.32,.18,.38],6,0);mesh.box([x,y+h*.8,z],[r*1.4,h*1.6,r*1.4],c,a,true);}
  else if(id===6){if(y>.008){mesh.cone([x,y,z],r*.6,h*.45,[.25,.085,.035],6,0);mesh.box([x,y+h*.1,z],[r*.6,h*.2,r*.6],c,a,true);}}
  else if(id===7){if(y>.009)mesh.cone([x,y,z],r*1.6,h*.45,[.52,.50,.38],7,r*.4);}
  else {mesh.cone([x,y,z],r*1.6,h*(id===3?1:.5),c,6,r*.25);mesh.box([x,y+h*.14,z],[r*1.1,h*.28,r*1.1],c,a,true);}
 }
 // Survey pad and metre-scale bollards give every site a legible human scale.
 const pad=ground(mesh,0,0);mesh.box([0,pad+.00025,0],[.006,.0005,.006],[.16,.18,.17],0,false);
 for(const x of [-.003,.003])for(const z of [-.003,.003])mesh.box([x,pad+.0007,z],[.00018,.0014,.00018],[.40,.33,.16],0,true);
}
const cache=new Map();
function site(s){if(!s.siteId||!s.siteAnchor||s.layoutVersion!==2)return null;const key=JSON.stringify([s.siteId,s.siteAnchor,s.radius,s.seed,s.era,s.shellThickness]);if(cache.has(key))return cache.get(key);let mesh;
 let id=s.siteId.startsWith('biome-')?Number(s.siteId.slice(6)):s.siteId.startsWith('port-')?15:s.siteId.startsWith('shade-')?14:4;
 if(id===4&&s.era==='before')id=5;const q=s.siteAnchor,basis=shellFrame(q);mesh=new Mesh(mul(q,s.radius),basis,W.names[id]);
 if(s.siteId.startsWith('biome-')||s.siteId.startsWith('port-')){terrain(mesh,id,s);populate(mesh,id,s);if(s.siteId.startsWith('port-')){for(const z of [-.18,.18]){mesh.box([-.10,.075,z],[.045,.15,.045],[.16,.19,.20]);mesh.box([.10,.075,z],[.045,.15,.045],[.16,.19,.20]);mesh.box([0,.15,z],[.25,.02,.05],[.10,.12,.13],0,false);mesh.box([0,.145,z],[.19,.001,.008],[.1,.55,.42],0,false,.15);}mesh.name='Polar entry · service court';}}
 mesh.finish();cache.set(key,mesh);while(cache.size>5)cache.delete(cache.keys().next().value);return mesh;
}
function rim(s){return root.SphereEdges.rimMeshes(s)[0]||null;}
function shadeSection(s){return root.SphereEdges.shadeSection(s);}
const exteriorCache=new Map();
function exterior(s,fleetsOnly=false){if(s.layoutVersion!==2||!s.collection||s.era!=='after'||!s.wreckage||!s.siteId.startsWith('exterior-'))return null;const cacheKey=JSON.stringify([s.siteAnchor,s.radius,s.seed,s.spaceEnvironment]);if(!fleetsOnly&&exteriorCache.has(cacheKey))return exteriorCache.get(cacheKey);const q=s.siteAnchor,basis=shellFrame(q),origin=mul(q,s.radius+2500),mesh=new Mesh(origin,basis,['Breach spill','Ancient graveyard','Contested approach'][s.spaceEnvironment]),rnd=random(s.seed*877+s.spaceEnvironment*97);
 root.SphereWreckage.build(s,mesh,rnd,fleetsOnly);
 mesh.finish();if(!fleetsOnly){exteriorCache.set(cacheKey,mesh);while(exteriorCache.size>3)exteriorCache.delete(exteriorCache.keys().next().value);}return mesh;
}
let geometryKey='',geometryResult=[];
function geometry(s){if(!s.geometryDetail||s.layoutVersion!==2||!s.collection)return [];const isExterior=s.siteId.startsWith('exterior-'),key=JSON.stringify([s.siteId,s.siteAnchor,s.position.map(v=>Math.round(v/.025)),root.SphereEdges.revision,s.fov,s.radius,s.era,s.seed,s.shellThickness,s.multipleWounds,s.wreckage,s.spaceEnvironment,s.shadeShape,s.shadeTrim,s.cycleScale,s.routeShades,s.axisLat,s.axisLon,s.waistWidth,isExterior&&s.spaceEnvironment===2?Math.floor(s.time*10):0,s.siteId.startsWith('shade-')?s.time:0]);if(key===geometryKey)return geometryResult;geometryKey=key;geometryResult=[];const local=site(s);if(local&&local.count&&M.length(sub(s.position,local.origin))<20)geometryResult.push(local);geometryResult.push(...root.SphereEdges.rimMeshes(s),...root.SphereEdges.shadeMeshes(s));const ex=exterior(s);if(ex){geometryResult.push(ex);if(s.spaceEnvironment>0)geometryResult.push(exterior(s,true));}return geometryResult;}
function blocked(mesh,x,y,z){const radius=.00028;return mesh.boxes.some(b=>{const c=Math.cos(b.angle),s=Math.sin(b.angle),dx=x-b.center[0],dz=z-b.center[2],lx=dx*c+dz*s,lz=-dx*s+dz*c;return Math.abs(lx)<b.half[0]+radius&&Math.abs(lz)<b.half[2]+radius&&y-EYE<b.center[1]+b.half[1]&&y>b.center[1]-b.half[1];});}
let jumpHeld=false;
function step(s,keys,dt){if(!s.walkMode)return false;const mesh=site(s);if(!mesh?.ground)return false;const up=mesh.basis[1],f=norm(sub(s.forward,mul(up,dot(s.forward,up)))),right=norm(cross(f,up));let v=[0,0,0];for(const [key,d] of [['KeyW',f],['KeyS',mul(f,-1)],['KeyD',right],['KeyA',mul(right,-1)]])if(keys.has(key))v=add(v,d);const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?.006:.0028),walking=M.length(v)>0,p=s.walkPosition.slice();if(walking){v=mul(norm(v),speed*dt);const dx=dot(v,mesh.basis[0]),dz=dot(v,mesh.basis[2]);for(const [axis,d] of [[0,dx],[2,dz]]){const next=p.slice();next[axis]=M.clamp(p[axis]+d,-1.08,1.08);const h=ground(mesh,next[0],next[2])+EYE+.0005;if(h-p[1]>.00045)continue;next[1]=Math.max(p[1],h);if(!blocked(mesh,...next)){p[axis]=next[axis];}}}
 let floor=ground(mesh,p[0],p[2])+EYE+.0005;const overlaps=mesh.boxes.filter(b=>{const c=Math.cos(b.angle),sn=Math.sin(b.angle),x=p[0]-b.center[0],z=p[2]-b.center[2];return Math.abs(x*c+z*sn)<b.half[0]+.00028&&Math.abs(-x*sn+z*c)<b.half[2]+.00028;});
 for(const b of overlaps){const top=b.center[1]+b.half[1]+EYE;if(top<=p[1]+.00001)floor=Math.max(floor,top);}
 const onGround=p[1]<=floor+.00001;if(keys.has('Space')&&!jumpHeld&&onGround)s.walkVelocity=.0037;jumpHeld=keys.has('Space');s.walkVelocity=(s.walkVelocity||0)-.00981*dt;let nextY=p[1]+s.walkVelocity*dt;
 for(const b of overlaps){const ceiling=b.center[1]-b.half[1]-.00015;if(s.walkVelocity>0&&p[1]<=ceiling&&nextY>ceiling){nextY=ceiling;s.walkVelocity=0;}}
 p[1]=nextY;if(p[1]<=floor){p[1]=floor;s.walkVelocity=0;}s.walkPosition=p;s.position=mesh.world(p);s.up=M.basis(s.forward,up).u;
 return walking||!onGround||keys.has('Space');
}
function enterWalk(s){const mesh=site(s);if(!mesh?.ground)throw Error('Choose a biome or polar entry field site first.');s.walkMode=true;s.walkPosition=[0,ground(mesh,0,0)+EYE+.0005,0];s.position=mesh.world(s.walkPosition);s.forward=norm(add(mesh.basis[2],mul(mesh.basis[1],.035)));s.up=M.basis(s.forward,mesh.basis[1]).u;s.fov=82;s.projection='perspective';s.playing=false;s.walkVelocity=0;jumpHeld=false;return s;}
function rayTriangle(p,d,a,b,c){const e1=sub(b,a),e2=sub(c,a),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-14)return Infinity;const inv=1/det,t=sub(p,a),u=dot(t,h)*inv;if(u<0||u>1)return Infinity;const q=cross(t,e1),v=dot(d,q)*inv;if(v<0||u+v>1)return Infinity;const distance=dot(e2,q)*inv;return distance>.000001?distance:Infinity;}
function buildBVH(triangles){if(!triangles.length)return null;const items=triangles.map(t=>({t,min:[0,1,2].map(i=>Math.min(...t.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...t.map(p=>p[i])))}));function build(items){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const item of items)for(let i=0;i<3;i++){min[i]=Math.min(min[i],item.min[i]);max[i]=Math.max(max[i],item.max[i]);}if(items.length<=12)return {min,max,items};let axis=0;for(let i=1;i<3;i++)if(max[i]-min[i]>max[axis]-min[axis])axis=i;items.sort((a,b)=>a.min[axis]+a.max[axis]-b.min[axis]-b.max[axis]);const half=items.length>>1;return {min,max,left:build(items.slice(0,half)),right:build(items.slice(half))};}return build(items);}
function rayBVH(p,d,node,closest=Infinity,contact=null){if(!node)return closest;let near=0,far=closest;for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-14){if(p[i]<node.min[i]||p[i]>node.max[i])return closest;continue;}let a=(node.min[i]-p[i])/d[i],b=(node.max[i]-p[i])/d[i];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return closest;}if(node.lazyTriangles){const tree=buildBVH(node.lazyTriangles);delete node.lazyTriangles;Object.assign(node,tree);}if(node.items){for(const {t}of node.items){const distance=rayTriangle(p,d,...t);if(distance<closest){closest=distance;if(contact)contact.normal=norm(cross(sub(t[1],t[0]),sub(t[2],t[0])));}}return closest;}return rayBVH(p,d,node.right,rayBVH(p,d,node.left,closest,contact),contact);}
function trace(p,d,s,original){let result=original(p,d,s);if(!s.geometryDetail||s.layoutVersion!==2)return result;for(const mesh of geometry(s)){const lp=mesh.local(p),ld=mesh.basis.map(b=>dot(d,b)),t=rayBVH(lp,ld,mesh.bvh,result.distance);if(t<result.distance)result={kind:mesh.name,distance:t,point:add(p,mul(d,t)),geometry:true};}return result;}
root.SphereSites={Mesh,site,rim,shadeSection,exterior,geometry,ground,blocked,height,noise,step,enterWalk,rayTriangle,rayBVH,trace,shellFrame,SITE_RADIUS,EYE};
})(typeof window==='undefined'?globalThis:window);

if(typeof module!=='undefined'&&module.exports)require('./edge-stream.js');
