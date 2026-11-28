/* Bundled Violet Labyrinth habitat. Positions, heights and radii are in kilometres. */
(function(root){
'use strict';
const M=root.SphereMath,W=root.SphereWorld;
const tau=2*Math.PI, material=-8, localMaterialKm=240;
let referenceKey,reference;

function referenceGrove(s){
  const key=[s.seed,s.radius,s.axisLat,s.axisLon,s.waistWidth,s.era,s.layoutVersion,s.transitionKm,s.collection,s.multipleWounds,s.biome,
    s.breachEnabled,s.breachLat,s.breachLon,s.breachDiameter,s.breachRoughness].join('/');
  if(key===referenceKey)return reference;
  const anchor=W.locateBiome(9,s,{sunlit:false}),basis=root.SphereSites.shellFrame(anchor),origin=M.mul(anchor,s.radius);
  // Replay the original field site's random stream. The clear landing and all
  // 320 candidate slots keep their old geographic positions and silhouettes.
  let seed=(s.seed*8191+9*977)>>>0;
  const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
  const spires=[];
  for(let i=0;i<320;i++){
    const x=(random()*2-1)*1.08,z=(random()*2-1)*1.08;
    if(Math.hypot(x,z)<.055)continue;
    const radius=.003+random()*.009,height=(.008+random()*.036)*2.55;
    const rotation=random()*tau,variation=.6+random()*.6;
    const q=M.norm(M.add(origin,M.add(M.mul(basis[0],x),M.mul(basis[2],z))));
    spires.push({q,radius,height,rotation,variation,id:'violet/'+s.seed+'/reference/'+i});
  }
  referenceKey=key;reference={anchor,origin,basis,spires};return reference;
}

// The GPU samples these same two winding seams for the distant grove pattern.
// Recover the two signed analytic seams that are already visible at survey height.
function veins(q,s){
 const p=q.map(n=>((n*s.radius/16)%64+64)%64+s.seed*.03125);
 const wave=(a,b,c)=>Math.sin(tau*(a+b*.5))+Math.sin(tau*(b*.5-c*.25))*.55;
 return [wave(...p),wave(p[2],p[0],p[1])-.34];
}
function cover(q,s){const [a,b]=veins(q,s);return Math.min(Math.abs(a),Math.abs(b));}
function fieldRay(grove,x,z){
 return M.norm(M.add(grove.origin,M.add(M.mul(grove.basis[0],x),M.mul(grove.basis[2],z))));
}
function surveyFork(s){
 const grove=referenceGrove(s),sample=(x,z)=>veins(fieldRay(grove,x,z),s);
 const gradient=(x,z)=>{
   const p=sample(x,z),a=sample(x+.012,z),b=sample(x,z+.012);
   return {p,dx:a.map((v,i)=>(v-p[i])/.012),dz:b.map((v,i)=>(v-p[i])/.012)};
 };
 const sight=[.65,.76],candidates=[];
 // The first visible ground in the shallow 11.355 km camera lies ahead of
 // the grove. Select an intersection in that actual sightline.
 for(let x=-16;x<=80;x+=3)for(let z=-16;z<=86;z+=3){
   let e=x,n=z,solved=false;
   for(let i=0;i<14;i++){
     const {p,dx,dz}=gradient(e,n),det=dx[0]*dz[1]-dx[1]*dz[0];
     if(Math.abs(det)<.00008)break;
     if(Math.hypot(...p)<.000001){solved=true;break;}
     const de=(p[0]*dz[1]-p[1]*dz[0])/det,dn=(dx[0]*p[1]-dx[1]*p[0])/det;
     if(Math.hypot(de,dn)>8)break;
     e-=de;n-=dn;
   }
   if(!solved||candidates.some(v=>Math.hypot(e-v.x,n-v.z)<.05))continue;
   const range=Math.hypot(e,n),ahead=e*sight[0]+n*sight[1],cross=Math.abs(e*sight[1]-n*sight[0]);
   if(ahead<14||ahead>90||cross>Math.min(45,ahead*.99))continue;
   const q=fieldRay(grove,e,n);
   if(W.sample(q,s).biome!==9||root.SphereMath.inBreach(q,s)||root.SphereCollection.missing(q,s))continue;
   candidates.push({x:e,z:n,q,range,score:Math.abs(ahead-34)+1.5*cross});
 }
 candidates.sort((a,b)=>a.score-b.score||a.range-b.range);
 function arm(node,component,sign){
   let x=node.x,z=node.z,previous=null;const points=[[x,z]];
   for(let i=0;i<39;i++){
     const g=gradient(x,z),mag=Math.hypot(g.dx[component],g.dz[component]);
     if(mag<.012)break;
     let tx=-g.dz[component]/mag,tz=g.dx[component]/mag;
     if(previous?tx*previous[0]+tz*previous[1]<0:sign<0){tx=-tx;tz=-tz;}
     x+=tx*.060;z+=tz*.060;
     const next=gradient(x,z),a=next.dx[component],b=next.dz[component],den=a*a+b*b;
     if(den<.0001)break;
     x-=next.p[component]*a/den;z-=next.p[component]*b/den;previous=[tx,tz];points.push([x,z]);
   }
   return points;
 }
 for(const node of candidates){
   const g=gradient(node.x,node.z),entrySign=(-g.dz[0]*-node.x+g.dx[0]*-node.z)<0?-1:1;
   const arms=[arm(node,0,entrySign),arm(node,1,1),arm(node,1,-1)];
   if(arms.every(path=>path.length>=38))return {id:'violet/'+s.seed+'/fork/'+Math.round(node.x*1000)+'/'+Math.round(node.z*1000),
     q:node.q,x:node.x,z:node.z,arms};
 }
 return null;
}
function referenceFork(s){
 const grove=referenceGrove(s);
 if(!Object.hasOwn(grove,'mineralFork'))grove.mineralFork=surveyFork(s);
 return grove.mineralFork;
}
// Short, broken mineral faces flank the walkable seam. Each fragment has
// one geographic owner and enters the same triangle BVH as the native spires.
function emitFork(mesh,f,s,floor,bounds,props){
 const grove=referenceGrove(s),center=M.norm(f.world([(bounds[0]+bounds[2])*.5,0,(bounds[1]+bounds[3])*.5]));
 if(M.length(M.sub(center,grove.anchor))*s.radius>85)return;
 const fork=referenceFork(s);if(!fork||M.length(M.sub(center,fork.q))*s.radius>4.5)return;
 const project=p=>f.local(M.mul(fieldRay(grove,p[0],p[1]),s.radius));
 for(const [arm,path] of fork.arms.entries())for(let i=1;i<path.length;i++){
   const a=project(path[i-1]),b=project(path[i]),dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);
   if(!len)continue;
   const tx=dx/len,tz=dz/len;
   for(const side of [-1,1]){
    const noise=root.SphereSites.noise(i,arm,s.seed+side),dist=.014+.006*noise;
    const x=(a[0]+b[0])*.5-tz*side*dist,z=(a[2]+b[2])*.5+tx*side*dist;
    if(x<bounds[0]||x>=bounds[2]||z<bounds[1]||z>=bounds[3])continue;
    const record={},hit=root.SphereSites.rayBVH([x,10,z],[0,-1,0],floor,Infinity,record);if(!record.normal)continue;
    const y=10-hit,half=.018+.009*noise,w=.005+.004*noise,h=.003+.005*noise;
    const v=(t,l,rise)=>[x+t*tx-l*tz,y+rise,z+t*tz+l*tx];
    const p=v(-half,-w,-.0004),q=v(half,-w,-.0004),r=v(half*.81,w,-.0004),u=v(-half*.76,w,-.0004);
    const c=v(-half*.7,-w*.13,h*.78),d=v(half*.55,w*.12,h);
    const bright=[.51+.12*noise,.34+.10*noise,.66+.14*noise],dark=[.19,.095,.29];
    mesh.quad(p,c,d,q,bright,material);mesh.quad(u,r,d,c,dark,material);
    props.push(fork.id+'/arm/'+arm+'/'+i+'/'+side);
    mesh.tri(p,u,c,[.32,.23,.43],material);mesh.tri(q,d,r,[.69,.53,.76],material);
   }
 }
}
const boundForks=new WeakMap();
function bindFork(gl,u,s,n){
 if(u.uVioletFork==null)return;
 let fork=null;
 if(s.collection && Math.abs(s.radius-M.length(s.position))<localMaterialKm && (s.siteId==='biome-9'||W.sample(n,s).biome===9)){
   const grove=referenceGrove(s);
   if(M.length(M.sub(n,grove.anchor))*s.radius<200)fork=referenceFork(s);
 }
 if(!fork){gl.uniform4f(u.uVioletFork,0,0,0,0);return;}
 const delta=M.mul(M.sub(fork.q,n),s.radius),grove=referenceGrove(s);
 gl.uniform4f(u.uVioletFork,delta[0],delta[1],delta[2],1);
 if(boundForks.get(u)!==fork){
   // A coarse trace of the very same three collidable arms fits in nine vectors.
   const offsets=fork.arms.flatMap(path=>[12,25,path.length-1].flatMap(i=>M.mul(M.sub(fieldRay(grove,...path[i]),fork.q),s.radius)));
   gl.uniform3fv(u['uVioletArm[0]'],offsets);boundForks.set(u,fork);
 }
}
const glsl=`
uniform vec4 uVioletFork;
uniform vec3 uVioletArm[9];
float violetVein(vec3 p){return sin(6.2831853*(p.x+p.y*.5))+.55*sin(6.2831853*(p.y*.5-p.z*.25));}
float violetGrove(vec3 p){float gap=min(abs(violetVein(p)),abs(violetVein(p.zxy)-.34));return smoothstep(.04,.28,gap);}
vec3 violetForkRock(vec3 rock,vec3 p,vec3 delta){
 float seam=1.-violetGrove(p);
 rock=mix(rock*vec3(1.16,.98,1.19),vec3(.43,.28,.55)+.30*rock,seam*.55);
 vec3 rel=delta-uVioletFork.xyz;
 float aa=clamp(.45*length(fwidth(rel)),.003,.090);
 if(uVioletFork.w==0.||dot(rel,rel)>7.0)return rock;
 float nearest=3.;
 for(int arm=0;arm<3;arm++){
   vec3 a=vec3(0.);
   for(int j=0;j<3;j++){
     vec3 b=uVioletArm[arm*3+j],v=b-a;
     nearest=min(nearest,length(rel-a-v*clamp(dot(rel-a,v)/max(dot(v,v),.000001),0.,1.)));
     a=b;
   }
 }
 float edge=1.-smoothstep(.075-aa,.110+aa,nearest);
 float quartz=1.-smoothstep(.016-aa,.032+aa,nearest);
 rock=mix(rock,vec3(.12,.055,.21),edge*.84);
 return mix(rock,vec3(.82,.69,.86),quartz*.88);
}
`;
function emit(mesh,base,axes,spire){
  const {radius,height,rotation,variation}=spire;
  const point=(angle,r,h)=>M.add(base,M.add(M.mul(axes[1],h),M.add(M.mul(axes[0],Math.cos(angle)*r),M.mul(axes[2],Math.sin(angle)*r))));
  const tip=M.add(base,M.mul(axes[1],height));
  for(let side=0;side<6;side++){
    const a=rotation+side*tau/6,b=a+tau/6;
    const foot=point(a,radius,0),next=point(b,radius,0);
    const crown=point(a,radius*.75,height*2/2.55),nextCrown=point(b,radius*.75,height*2/2.55);
    const tint=variation*(.84+.16*Math.cos(a));
    mesh.quad(foot,next,nextCrown,crown,[.21*tint,.09*tint,.29*tint],material);
    mesh.tri(crown,nextCrown,tip,[.42*tint,.24*tint,.53*tint],material);
  }
}
root.SphereVioletForest={bindFork,localMaterialKm,referenceGrove,referenceFork,surveyFork,veins,fieldRay,cover,emit,emitFork,glsl,material};
})(typeof window==='undefined'?globalThis:window);
