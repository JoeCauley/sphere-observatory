/* Flight-to-walk handoff. Legacy patches retain their bounds; revision 2 uses
 * pinned connected support. All distances are kilometres and coordinates
 * stay in doubles. This controller queries the actual rendered triangles. */
(function(root){
'use strict';
const M=root.SphereMath,W=root.SphereWorld,S=root.SphereSites,F=root.SphereFlight;
const TRIGGER=.1,REARM=.2,EYE=S.EYE,SKIN=.00028,HEAD=.00015,STEP=.00045;
let suppressed=null,approach=null,jumpHeld=false;
function elevation(s,p){
 const q=M.norm(p),province=root.SphereWatershed?.sample(q,s);let h=province?.terrainKm||0;
 if(/^(biome|port)-/.test(s.siteId)&&s.siteAnchor&&M.dot(q,s.siteAnchor)>0){const mesh=S.site(s),local=mesh.local(p);if(s.siteRevision===2||Math.max(Math.abs(local[0]),Math.abs(local[2]))<1.08)h=Math.max(h,(s.siteRevision===2?0:s.siteElevation||0)+S.ground(mesh,local[0],local[2]));}
 return h;
}
function clearance(s,p){return s.radius-M.length(p)-elevation(s,p);}
function heightAboveGround(s){
 const altitude=s.radius-M.length(s.position);
 if(s.geometryDetail&&s.collection&&s.layoutVersion===2&&altitude>=0&&altitude<5&&!M.inBreach(M.norm(s.position),s)){
  const mesh=s.walkMode?S.site(s):null,down=mesh?M.mul(mesh.basis[1],-1):M.norm(s.position),hit=probe(s,s.position,down,5);
  if(Number.isFinite(hit.distance)&&hit.kind!=='Shade')return hit.distance;
 }
 return altitude;
}
function release(s){suppressed=M.norm(s.position);approach=null;s.walkMode=false;s.walkSurface=false;s.walkPosition=null;s.walkVelocity=0;}
function probe(s,p,d,max=Infinity){
 const analytic=M.trace(p,d,s);let hit={distance:analytic.distance,normal:M.mul(M.norm(p),-1),kind:analytic.kind};
 for(const mesh of S.geometry(s)){const record={},t=S.rayBVH(mesh.local(p),mesh.basis.map(b=>M.dot(d,b)),mesh.bvh,Math.min(max,hit.distance),record);if(!record.normal)continue;
  let n=mesh.basis.reduce((v,b,i)=>M.add(v,M.mul(b,record.normal[i])),[0,0,0]);if(M.dot(n,d)>0)n=M.mul(n,-1);hit={distance:t,normal:n,kind:mesh.name};
 }
 return hit.distance<=max?hit:{distance:Infinity,normal:null,kind:''};
}
function patch(s,position){
 const old=/^(biome|port)-/.test(s.siteId)&&s.siteAnchor?S.site(s):null;
 // Opposite shell points share tangent-plane x/z coordinates. Reuse requires
 // proximity in all three dimensions, otherwise a diametric flight can attach
 // the far-side arrival to a patch nearly two radii behind the camera.
 if(old){const local=old.local(position);if(Math.abs(local[1])<20&&(s.siteRevision===2?Math.max(Math.abs(local[0]),Math.abs(local[2]))<20:Math.max(Math.abs(local[0]),Math.abs(local[2]))<.9)){if(s.siteRevision===2){s.terrainAnchor??=s.siteAnchor;s.siteAnchor=M.norm(position);}return old;}}
 const q=M.norm(position),region=W.sample(q,s),province=root.SphereWatershed?.sample(q,s);
 s.siteId=region.id===15?'port-'+(M.dot(q,W.frame(s).axis)>0?'0':'1'):'biome-'+region.biome;
 s.siteAnchor=q;s.siteRevision=s.terrainRevision??1;s.terrainAnchor=s.siteRevision===2?q:null;s.siteElevation=province?.terrainKm||0;s.geometryDetail=true;
 return S.site(s);
}
function enter(s,position){
 const mesh=patch(s,position),p=mesh.local(position),up=mesh.basis[1];s.position=position;
 // A new local terrain sample can rise a few metres above the coarse shell.
 // Place the camera above its real support before starting the gentle descent.
 p[1]=Math.max(p[1],S.ground(mesh,p[0],p[2])+EYE+.0005);
 s.walkPosition=p;s.position=mesh.world(p);s.walkMode=true;s.walkSurface=true;s.walkVelocity=0;
 s.shadeAttachment=null;s.projection='perspective';s.surfaceLock=true;
 const b=M.basis(s.forward,s.up),tangent=M.sub(s.forward,M.mul(up,M.dot(s.forward,up)));
 const heading=M.length(tangent)>.03?M.norm(tangent):M.norm(M.cross(up,b.r)),forward=M.norm(M.add(heading,M.mul(up,-.055)));
 approach={anchor:s.siteAnchor.slice(),time:0,startY:p[1],startForward:s.forward.slice(),forward,lastForward:s.forward.slice()};jumpHeld=false;
 return s;
}
function move(s,d,distance){
 // Prepare a fixed geographic neighbourhood during the final approach, before
 // the 100 m handoff. Old terrain revisions keep their saved local patches.
 if(s.terrainRevision===2&&s.geometryDetail&&M.dot(s.position,d)>0&&s.siteRevision!==1&&!s.walkMode&&s.shadeAttachment===null&&s.radius-M.length(s.position)<5&&s.radius-M.length(s.position)>=0&&!M.inBreach(M.norm(s.position),s)){patch(s,s.position);root.SphereGround?.request(s);}
 const start=s.position.slice(),result=F.move(s,d,distance);
 if(s.walkMode||s.autoWalk===false||s.layoutVersion!==2||!s.collection||!s.geometryDetail||s.shadeAttachment!==null)return result;
 // Test the original flight segment before collision adds a tangential glide.
 // Otherwise a fast descent would move its landing address along the hillside.
 const end=result.firstContact!==null&&result.firstContact!==undefined?M.add(start,M.mul(M.norm(d),result.firstContact)):result.position;
 const before=clearance(s,start),after=clearance(s,end);
 if(suppressed){if(before>REARM||M.length(M.sub(suppressed,M.norm(start)))*s.radius>3)suppressed=null;else return result;}
 if(after>TRIGGER||after>=before-1e-7||before<-.05||s.radius-M.length(end)<0)return result;
 let t=0;if(before>TRIGGER){let lo=0,hi=1;for(let i=0;i<32;i++){const mid=(lo+hi)/2,p=M.add(start,M.mul(M.sub(end,start),mid));if(clearance(s,p)>TRIGGER)lo=mid;else hi=mid;}t=hi;}
 const position=M.add(start,M.mul(M.sub(end,start),t)),q=M.norm(position);
 if(M.inBreach(q,s))return result;
 const province=root.SphereWatershed?.sample(q,s);
 // Water is not a solid walking floor. Keep flight available over open water;
 // a bank or an existing garden terrace provides the landing surface.
 if(province&&(province.water.river||province.water.basin)&&!province.service)return result;
 enter(s,position);return {...result,position:s.position.slice(),landed:true};
}
function floorAt(s,mesh,p,rise=STEP){
 const start=mesh.world([p[0],p[1]-EYE+rise,p[2]]),hit=probe(s,start,M.mul(mesh.basis[1],-1),10);
 return Number.isFinite(hit.distance)?p[1]-EYE+rise-hit.distance+EYE+.00002:-Infinity;
}
function obstructed(s,mesh,p,delta){
 const length=M.length(delta);if(length<1e-12)return false;const d=M.mul(delta,1/length),up=mesh.basis[1];
 // Feet, waist and head prevent slipping through a ledge, wall or overhang.
 for(const height of [STEP+.0001,EYE*.55,EYE+HEAD]){
  const start=mesh.world([p[0],p[1]-EYE+height,p[2]]),hit=probe(s,start,d,length+SKIN);
  if(hit.distance<length+SKIN&&Math.abs(M.dot(hit.normal,up))<.72)return true;
 }
 return false;
}
function step(s,keys,dt){
 if(s.siteRevision===2)root.SphereGround.rebaseWalking(s);
 const mesh=S.site(s);if(!mesh?.ground||!s.walkPosition)return false;
 if(s.siteRevision===2&&!root.SphereGround.support(s,s.walkPosition[0],s.walkPosition[2]))return false;
 const p=s.walkPosition.slice(),up=mesh.basis[1];let changed=false;
 if(approach&&M.length(M.sub(approach.anchor,s.siteAnchor))<1e-12){
  approach.time+=dt;const t=M.clamp(approach.time/2.4,0,1),ease=t*t*(3-2*t),floor=floorAt(s,mesh,[p[0],approach.startY,p[2]],.001);
  if(Number.isFinite(floor)){p[1]=approach.startY+(floor-approach.startY)*ease;changed=true;}
  // Preserve an intentional look made with the mouse during the descent.
  if(M.length(M.sub(s.forward,approach.lastForward))<1e-8){s.forward=M.norm(M.add(M.mul(approach.startForward,1-ease),M.mul(approach.forward,ease)));approach.lastForward=s.forward.slice();}
  if(t===1)approach=null;
 }else{
  const projected=M.sub(s.forward,M.mul(up,M.dot(s.forward,up))),f=M.length(projected)>.001?M.norm(projected):mesh.basis[2],right=M.norm(M.cross(f,up));let v=[0,0,0];
  for(const [key,dir]of [['KeyW',f],['KeyS',M.mul(f,-1)],['KeyA',M.mul(right,-1)],['KeyD',right]])if(keys.has(key))v=M.add(v,dir);
  if(M.length(v)>0){v=M.mul(M.norm(v),(keys.has('ShiftLeft')||keys.has('ShiftRight')?.006:.0028)*dt);
   for(const axis of [0,2]){const next=p.slice(),offset=M.dot(v,mesh.basis[axis]);next[axis]=s.siteRevision===2?next[axis]+offset:M.clamp(next[axis]+offset,-1.08,1.08);if(s.siteRevision===2&&!root.SphereGround.support(s,next[0],next[2]))continue;const floor=floorAt(s,mesh,next),delta=M.mul(mesh.basis[axis],next[axis]-p[axis]);
    const drop=!Number.isFinite(floor)&&(mesh.ground.rim||s.siteRevision===2)&&M.inBreach(M.norm(mesh.world(next)),s);
    if((drop||(Number.isFinite(floor)&&floor<=p[1]+STEP+.00003))&&!obstructed(s,mesh,p,delta)){p[axis]=next[axis];if(floor>p[1])p[1]=floor;changed=true;}
   }
  }
  const floor=floorAt(s,mesh,p),onGround=Number.isFinite(floor)&&p[1]<=floor+.00003;
  if(keys.has('Space')&&!jumpHeld&&onGround)s.walkVelocity=.0037;jumpHeld=keys.has('Space');
  s.walkVelocity=(s.walkVelocity||0)-.00981*dt;let nextY=p[1]+s.walkVelocity*dt;
  if(nextY>p[1]){const hit=probe(s,mesh.world(p),up,nextY-p[1]+HEAD);if(Number.isFinite(hit.distance)){nextY=p[1]+Math.max(0,hit.distance-HEAD);s.walkVelocity=0;}}
  if(Number.isFinite(floor)&&nextY<=floor){nextY=floor;s.walkVelocity=0;}
  changed=changed||Math.abs(nextY-p[1])>1e-10;p[1]=nextY;
 }
 s.walkPosition=p;s.position=mesh.world(p);s.up=M.basis(s.forward,up).u;
 // A physical opening is not a streaming frontier. After falling clear of the
 // inner surface, hand control back to flight before leaving saved walk bounds.
 if((mesh.ground.rim||s.siteRevision===2)&&s.radius-M.length(s.position)<-.1)release(s);
 return changed;
}
root.SphereLanding={move,enter,release,step,probe,clearance,elevation,heightAboveGround,triggerKm:TRIGGER,rearmKm:REARM};
})(typeof window==='undefined'?globalThis:window);
