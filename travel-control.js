/* Reversible, distance-based flight assistance. Units: kilometres and seconds. */
(function(root){
'use strict';const M=root.SphereMath,F=root.SphereFlight;
const MAX=10000000,knots=[[0,.008],[.02,.018],[.1,.075],[1,.8],[10,9],[100,110],[1000,1400],[10000,18000],[100000,240000],[1000000,2700000],[10000000,MAX]];
let effective=0,lift=null,lastNear=null;
function curve(distance,scale=1){
 const x=Math.max(0,distance);let i=1;while(i<knots.length&&x>knots[i][0])i++;
 if(i===knots.length)return MAX;
 const [a,va]=knots[i-1],[b,vb]=knots[i],t=(Math.log1p(x)-Math.log1p(a))/(Math.log1p(b)-Math.log1p(a));
 return Math.min(MAX,Math.exp(Math.log(va)+(Math.log(vb)-Math.log(va))*t)*(1+(scale-1)*(1-M.clamp(x/1000,0,1))));
}
function regionScale(s){
 const q=M.norm(s.position);if(s.shadeAttachment!==null||/^shade-/.test(s.siteId))return .6;
 if(root.SphereWatershed?.sample(q,s))return .75;
 const id=root.SphereWorld?.sample(q,s).biome;return [0,1,4,8,9].includes(id)?.75:id===2?1.2:1;
}
function surroundings(s,d){
 const q=M.norm(s.position),altitude=s.radius-M.length(s.position),inside=altitude>=0;
 // The observer can pass through the star. Only land and structures govern
 // flight clearance; a luminous source is not a braking surface.
 let nearest=Infinity,normal=q,kind='';
 if(!M.inBreach(q,s)&&Math.abs(altitude)<nearest){nearest=Math.abs(altitude);normal=M.mul(q,inside?-1:1);kind='Shell';}
 if(s.collection)for(const plate of root.SphereCollection.plates(s)){
  const n=plate.shape==='cap'||plate.shape==='trimmed'?q:plate.normal;
  for(const sign of [-1,1]){const ray=M.mul(n,sign),distance=root.SphereCollection.diskDistance(M.mul(s.position,1/s.radius),ray,plate)*s.radius;
   if(distance<nearest){nearest=distance;normal=M.mul(ray,-1);kind='Shade';}}
 }
 // Nearby structures count in every direction, including when flying parallel
 // to a wall. The same visible triangles support walking and swept collision.
 if(s.geometryDetail&&root.SphereLanding){const b=M.basis(s.forward,s.up);
  for(const axis of [b.f,b.r,normal])for(const sign of [-1,1]){const ray=M.mul(axis,sign),hit=root.SphereLanding.probe(s,s.position,ray,Math.min(2,nearest));
   if(hit.distance<nearest){nearest=hit.distance;normal=hit.normal;kind=hit.kind;}}
 }
 const ahead=F.contact(s,s.position,d,MAX*2),forward=ahead.distance;
 return {nearest:Math.max(0,nearest),normal,kind,forward,approachNormal:ahead.normal};
}
function speed(s,d,dt,boost=false){
 if(s.autoSpeed===false){effective=s.speed*(boost?5:1);return effective;}
 const near=surroundings(s,d),target=curve(Math.min(near.nearest,near.forward),regionScale(s))*(boost?1.5:1);lastNear=near;
 // Acceleration is eased; the reverse gradient is an immediate safety ceiling.
 // The swept collision still provides the final guarantee against tunnelling.
 effective=effective>0?Math.min(target,effective+(target-effective)*(1-Math.exp(-dt*3))):target;
 effective=Math.min(MAX,effective,Number.isFinite(near.forward)?Math.max(.001,near.forward*.35/Math.max(dt,.001)):MAX);
 return effective;
}
function takeoff(s){
 if(!s.walkMode)return false;
 const mesh=root.SphereSites.site(s),up=mesh?.basis[1]||M.mul(M.norm(s.position),-1),heading=M.sub(s.forward,M.mul(up,M.dot(s.forward,up)));
 root.SphereLanding.release(s);
 lift={position:s.position.slice(),up,time:0,forward:s.forward.slice(),target:M.norm(M.add(M.length(heading)>.001?M.norm(heading):M.basis(up).r,M.mul(up,.24))),lastForward:s.forward.slice()};effective=.008;return true;
}
function stepTakeoff(s,dt){
 if(!lift)return false;
 if(M.length(M.sub(s.position,lift.position))>.00001||s.walkMode){lift=null;return false;}
 const old=lift.time;lift.time=lift.time+dt>=2-1e-9?2:lift.time+dt;const ease=t=>{t/=2;return t*t*(3-2*t);},height=.045*(ease(lift.time)-ease(old));
 const result=F.move(s,lift.up,height);s.position=result.position;lift.position=s.position.slice();
 if(M.length(M.sub(s.forward,lift.lastForward))<1e-8){const t=ease(lift.time);s.forward=M.norm(M.add(M.mul(lift.forward,1-t),M.mul(lift.target,t)));lift.lastForward=s.forward.slice();}
 s.up=M.basis(s.forward,lift.up).u;if(lift.time===2||result.blocked)lift=null;return true;
}
function level(s,dt){
 if(s.autoSpeed===false||s.surfaceLock===false||s.walkMode||lift||!lastNear||lastNear.nearest>1000)return false;
 const normal=lastNear.kind==='Shade'&&s.shadeAttachment===null?lastNear.normal:root.SphereInspection?.surface(s).up||M.mul(M.norm(s.position),s.radius>=M.length(s.position)?-1:1);if(Math.abs(M.dot(s.forward,normal))>.9998)return false;
 const desired=M.basis(s.forward,normal).u,angle=Math.atan2(M.dot(M.cross(s.up,desired),s.forward),M.dot(s.up,desired));
 if(Math.abs(angle)<1e-8)return false;const rate=.5+3.5*(1-M.clamp(lastNear.nearest/1000,0,1));
 s.up=M.norm(M.rotate(s.up,s.forward,angle*(1-Math.exp(-dt*rate))));return true;
}
function reset(){effective=0;lift=null;lastNear=null;}
root.SphereTravel={curve,regionScale,surroundings,speed,takeoff,stepTakeoff,level,reset,get lifting(){return !!lift;},get effectiveSpeed(){return effective;},maxSpeed:MAX};
})(typeof window==='undefined'?globalThis:window);
