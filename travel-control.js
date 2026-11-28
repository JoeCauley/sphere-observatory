/* Reversible, distance-based flight assistance. Units: kilometres and seconds. */
(function(root){
'use strict';const M=root.SphereMath,F=root.SphereFlight;
const MAX=10000000,knots=[[0,.008],[.02,.018],[.1,.075],[1,.8],[10,9],[100,110],[1000,1400],[10000,18000],[100000,240000],[1000000,2700000],[10000000,MAX]];
let effective=0,lift=null,lastNear=null,rimCache=null;
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
// A tear is a union of polygons. The section shared at a hinge, and parts of
// its mouth inside an already released bay, are entirely open to flight.
const fractureBanks=new WeakMap();
function exposedBanks(fracture,id){
 const regions=fracture.regions(id);
 if(fractureBanks.has(regions))return fractureBanks.get(regions);
 const edges=[],eps=64*Number.EPSILON;
 for(const {points} of regions){
  let a=points[points.length-1];
  for(const b of points){
   const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
   if(length)edges.push({x:a[0],y:a[1],dx,dy,length,cuts:[0,1]});
   a=b;
  }
 }
 // Split at crossings and at endpoints of collinear overlaps. Occupancy on
 // either side of a straight segment is constant between successive cuts.
 const addCut=(edge,t)=>{if(t>eps&&t<1-eps)edge.cuts.push(t);};
 const project=(edge,x,y)=>(x*edge.dx+y*edge.dy)/(edge.length*edge.length);
 for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
  const a=edges[i],b=edges[j],x=b.x-a.x,y=b.y-a.y;
  const det=a.dx*b.dy-a.dy*b.dx;
  if(Math.abs(det)>eps*a.length*b.length){
   const t=(x*b.dy-y*b.dx)/det,u=(x*a.dy-y*a.dx)/det;
   if(t>=-eps&&t<=1+eps&&u>=-eps&&u<=1+eps){addCut(a,t);addCut(b,u);}
  }else if(Math.abs(x*a.dy-y*a.dx)<=eps*a.length){
   addCut(a,project(a,x,y));addCut(a,project(a,x+b.dx,y+b.dy));
   addCut(b,project(b,-x,-y));addCut(b,project(b,a.dx-x,a.dy-y));
  }
 }
 const banks=[];
 for(const {x,y,dx,dy,length,cuts} of edges){
  cuts.sort((a,b)=>a-b);
  for(let k=1;k<cuts.length;k++){
   const lo=cuts[k-1],hi=cuts[k],span=hi-lo;
   if(span<=eps)continue;
   const t=(lo+hi)/2,mx=x+dx*t,my=y+dy*t,probe=Math.min(1e-10/length,span*.01);
   const left=fracture.margin(mx-dy*probe,my+dx*probe,id)>=0;
   const right=fracture.margin(mx+dy*probe,my-dx*probe,id)>=0;
   if(left!==right)banks.push({x:x+dx*lo,y:y+dy*lo,dx:dx*span,dy:dy*span});
  }
 }
 fractureBanks.set(regions,banks);
 return banks;
}
// A continuous, conservative distance to the authored Shade footprint, including
// cracks and holes. Implicit curves use their maximum slope, so this assistance
// may brake early on a curved bank; collision still uses the authoritative skin.
function shadeClearance(s,p){
 const radius=M.length(p.center)*s.radius,ax=p.size*(p.across||1)*s.radius,ay=p.size*s.radius,curved=p.shape==='cap'||p.shape==='trimmed',along=M.dot(s.position,p.normal);
 if(curved&&along<=0)return {distance:Math.max(0,M.length(M.sub(s.position,M.mul(p.center,s.radius)))-Math.hypot(ax,ay)),normal:M.norm(s.position)};
 const factor=curved?radius/along:1,u=M.dot(s.position,p.right)*factor/ax,v=M.dot(s.position,p.up)*factor/ay;
 const a=Math.abs(u),b=Math.abs(v),small=Math.min(ax,ay);
 let gap=p.shape==='square'?Math.hypot(Math.max(0,a-1)*ax,Math.max(0,b-1)*ay):Math.max(0,Math.hypot(u,v)-1)*small;
 if(p.shape==='trimmed')gap=Math.max(gap,Math.max(0,a-p.trim)*ax);
 if(p.damage===2){
  const fracture=root.SphereWorld.shadeFracture;
  if(fracture.margin(u,v,p.id)<0){
   // Bank endpoints live in the plate chart. Measure in kilometres so a
   // narrow cross-track panel cannot brake the pilot at voids from the old model.
   let nearestSquared=Infinity;
   for(const bank of exposedBanks(fracture,p.id)){
    const x=(u-bank.x)*ax,y=(v-bank.y)*ay,dx=bank.dx*ax,dy=bank.dy*ay;
    const t=M.clamp((x*dx+y*dy)/(dx*dx+dy*dy),0,1);
    nearestSquared=Math.min(nearestSquared,(x-t*dx)**2+(y-t*dy)**2);
   }
   gap=Math.max(gap,Math.sqrt(nearestSquared));
  }
 }else if(p.damage){
  const slope=(x,y)=>Math.hypot(x/ax,y/ay),edge=.09+.055*Math.sin(v*17)+.017*Math.sin(v*53),family=p.id%3;
  if(p.layoutVersion===2){
   if(family===0&&u>edge&&v>-.31)gap=Math.max(gap,Math.min((u-edge)/slope(1,1.836),(v+.31)*ay));
   if(family===1&&v>.13+.10*Math.sin(u*12)&&u>-.43)gap=Math.max(gap,Math.min((v-.13-.10*Math.sin(u*12))/slope(1.2,1),(u+.43)*ax));
   if(family===2)gap=Math.max(gap,(u+.36*v-.20-.04*Math.sin(v*31))/slope(1,1.60));
   gap=Math.max(gap,(.013-Math.abs(u+.27+.065*Math.sin(v*11)+.018*Math.sin(v*41)))/slope(1,1.453),(.009-Math.abs(v+.28+.052*Math.sin(u*17)+.011*Math.sin(u*57)))/slope(1.511,1));
   const x=Math.floor((u+1)*18),y=Math.floor((v+1)*18);
   if((x*13+y*7+p.id*11)%37===0)gap=Math.max(gap,Math.min((.29-Math.abs((u+1)*18-x-.5))*ax/18,(.34-Math.abs((v+1)*18-y-.5))*ay/18));
  }else{
   if(u>.12&&v>-.2)gap=Math.max(gap,Math.min((u-.12)*ax,(v+.2)*ay));
   gap=Math.max(gap,(.018-Math.abs(u+.3+.16*Math.sin(v*9)))/slope(1,1.44),(.012-Math.abs(v+.18+.11*Math.sin(u*10)))/slope(1.1,1));
  }
 }
 // Gnomonic chart distances contract on a cap. Use the minimum chart scale
 // through the bounded footprint and observer to retain a safe lower bound.
 if(curved)gap/=1+(Math.max(Math.hypot(u*ax,v*ay),Math.hypot(ax,ay))/radius)**2;
 const height=curved?M.length(s.position)-radius:along-radius,n=curved?M.norm(s.position):p.normal;
 const thickness=(p.thickness||0)*s.radius,clearance=height<0?-height:Math.max(0,height-thickness);
 return {distance:Math.hypot(clearance,gap),normal:M.mul(n,height<thickness*.5?-1:1)};
}
function surroundings(s,d){
 const q=M.norm(s.position),altitude=s.radius-M.length(s.position),inside=altitude>=0;
 // The observer can pass through the star. Only land and structures govern
 // flight clearance; a luminous source is not a braking surface.
 let nearest=Infinity,normal=q,kind='';
 if(!M.inBreach(q,s)&&Math.abs(altitude)<nearest){nearest=Math.abs(altitude);normal=M.mul(q,inside?-1:1);kind='Shell';}
 if(s.layoutVersion===2&&s.collection&&s.era==='after'&&s.multipleWounds&&(!Number.isFinite(nearest)||root.SphereWorld.woundMetric(q,s).km<1000)){
  if(Math.abs(altitude)>1e7)nearest=Math.abs(altitude);
  else{const key=q.join(',')+':'+s.radius;if(rimCache?.key!==key)rimCache={key,...root.SphereWorld.nearestRim(q,s)};
   const radius=M.clamp(M.length(s.position),s.radius,s.radius+s.shellThickness),point=M.mul(rimCache.point,radius),delta=M.sub(s.position,point);
   if(M.length(delta)<nearest){nearest=M.length(delta);normal=M.norm(delta);kind='Wound';}}
 }
 if(s.collection)for(const plate of root.SphereCollection.plates(s)){
  const hit=shadeClearance(s,plate);if(hit.distance<nearest){nearest=hit.distance;normal=hit.normal;kind='Shade';}
 }
 // Nearby structures count in every direction, including when flying parallel
 // to a wall. The same visible triangles support walking and swept collision.
 if(s.geometryDetail&&root.SphereSites?.nearestBVH){
  for(const mesh of root.SphereSites.geometry(s)){const hit=root.SphereSites.nearestBVH(mesh.local(s.position),mesh.bvh,Math.min(1000,nearest));
   if(hit.point&&hit.distance<nearest){nearest=hit.distance;normal=mesh.basis.reduce((v,b,i)=>M.add(v,M.mul(b,hit.normal[i])),[0,0,0]);kind=mesh.name;}}
 }
 const ahead=F.contact(s,s.position,d,MAX*2),forward=ahead.distance;
 return {nearest:Math.max(0,nearest),normal,kind,forward,approachNormal:ahead.normal};
}
function estimate(s,d=s.forward,boost=false){if(s.walkMode)return boost?.006:.0028;if(s.autoSpeed===false)return s.speed*(boost?5:1);const near=surroundings(s,d);return curve(Math.min(near.nearest,near.forward),regionScale(s))*(boost?1.5:1);}
function speed(s,d,dt,boost=false){
 if(s.autoSpeed===false){effective=s.speed*(boost?5:1);return effective;}
 const near=surroundings(s,d),target=curve(Math.min(near.nearest,near.forward),regionScale(s))*(boost?1.5:1);lastNear=near;
 // Acceleration is eased; the reverse gradient is an immediate safety ceiling.
 // The swept collision still provides the final guarantee against tunnelling.
 effective=effective>0?Math.min(target,effective+(target-effective)*(1-Math.exp(-dt*3)),effective*Math.exp(dt*3)):target;
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
function reset(){effective=0;lift=null;lastNear=null;rimCache=null;}
root.SphereTravel={curve,regionScale,shadeClearance,surroundings,estimate,speed,takeoff,stepTakeoff,level,reset,get lifting(){return !!lift;},get effectiveSpeed(){return effective;},maxSpeed:MAX};
})(typeof window==='undefined'?globalThis:window);
