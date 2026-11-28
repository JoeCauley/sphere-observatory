import {classes,freightAt,fits,releaseIn,generateStation} from './station.mjs';
import {unproject,project} from '../../kit/surface-route.js';
import {hallHalfM,linkHalfM,nearestSite,districtPoint,districtLocation,wallDistance,outsideDistrict,roofSlabM,freightSlabDepthM,facadeRib} from './district.mjs';
import {ribSpacing,ribs} from '../../kit/outfall-wall.mjs';
import {galleryBoxes,galleryTubes} from '../../kit/outfall-gallery.mjs';
import {feedPipe,plantSolids} from './maintenance.mjs';
import {inFreightOpening,freightObstruction} from './freight-bay.mjs';

const gallerySolids=galleryBoxes.filter(p=>p[8]).map(([x,y,z,w,h,d])=>[x-w/2,x+w/2,y-h/2,y+h/2,z-d/2,z+d/2]);
gallerySolids.push(...plantSolids);
export const walker={...classes[0],body:[.56,1.85,.56],speed:2.8};
for(const [[x,y,start],[,,end],r] of [...galleryTubes,feedPipe])gallerySolids.push([x-r,x+r,y-r,y+r,start,end]);
const galleryEnd=2+Math.max(...gallerySolids.map(solid=>solid[5]));

export function boardingPose(s,group=classes[0],far=false){
  const r=s.routes.find(r=>r.id===group.id),side=far?1:-1;
  return {eastM:s.address.chainageM+r.nearDoor[0],northM:side*(s.widthM/2+group.body[2]/2+3),
    altitudeM:group.eye,yaw:far?Math.PI:0,pitch:0,mode:'walk'};
}
function deckAt(r,z){
  for(let i=1;i<r.points.length;i++){
    const a=r.points[i-1],b=r.points[i];
    if(z>=a[2]&&z<=b[2])return a[1]+(b[1]-a[1])*(z-a[2])/(b[2]-a[2]);
  }
  return 0;
}
// Ground support is evaluated from the same route vertices used to draw the deck.
export function support(s,x,z,foot,group,step){
  const look=s.lookout;
  if(look && x>=look.west-group.body[0]/2 && x<=look.east && z>=look.near && z<=look.far && Math.abs(foot-look.y)<=step)return look.y;
  for(const r of s.routes){
    if(Math.abs(x-r.nearDoor[0])+group.body[0]/2>r.deckWidthM/2+.001)continue;
    const h=deckAt(r,z);
    if(r.id==='heavy' && h<0){
      // The ramp replaces the ground wherever it is cut. The freight track
      // covers only the middle portion, with a traversable tunnel underneath.
      const underTrack=Math.abs(z-s.widthM/2)<s.laneHalfM+group.body[2]/2;
      return underTrack && foot+group.body[1]>-freightSlabDepthM+.001 ? 0 : h;
    }
    if(Math.abs(foot-h)<=step)return h;
  }
  return 0;
}
function intersects(a,b,lo,hi){return Math.min(a,b)<=hi && Math.max(a,b)>=lo;}
// Reprojecting through the one-AU shell can put a contact a few hundredths
// of a millimetre inside its plane. Only inward motion enters the slab.
function entersSlab(a,b,center,half){
  const side=a<center?-1:1;
  const advance=(a-b)*side,end=(b-center)*side;
  return advance>0 && (end<half-.0002 || (advance>.0001 && end<half));
}
function entersBox(x,y,z,nx,ny,nz,left,right,floor,ceiling,near,far){
  let enter=0,exit=1;
  function clip(a,b,lo,hi){
    // Treat sub-millimetre chart roundoff at a face as contact, allowing
    // tangential movement while rejecting any driven penetration.
    if(Math.abs(a-lo)<.0002)a=lo;
    if(Math.abs(a-hi)<.0002)a=hi;
    if(Math.abs(b-lo)<.0002)b=lo;
    if(Math.abs(b-hi)<.0002)b=hi;
    if(a===b)return a>lo && a<hi;
    const start=(lo-a)/(b-a),end=(hi-a)/(b-a);
    enter=Math.max(enter,Math.min(start,end));exit=Math.min(exit,Math.max(start,end));
    return enter<exit;
  }
  return clip(x,nx,left,right) && clip(y,ny,floor,ceiling) && clip(z,nz,near,far);
}
// A handoff can arrive from above or from a real station doorway. An ordinary
// link has no exterior entrance. Older native saves could be underneath its roof.
export function recoverWallPose(d,p,group=walker,habitatPlot=null,verifiedPassage=false){
  const site=nearestSite(d,p.eastM);
  if(!site || p.altitudeM>=site.roofM+roofSlabM+group.eye-.01)return p;
  const x=p.eastM-site.x,half=site.widthM/2,pad=Math.max(group.body[0],group.body[2])/2;
  if(Math.abs(x)<=hallHalfM+pad+1 && Math.abs(p.northM)<=half+pad+1){
    const foot=p.altitudeM-group.eye,head=foot+group.body[1];
    if(head>site.roofM && !inFreightOpening(x,p.northM,pad,pad))return {...p,altitudeM:site.roofM+roofSlabM+group.eye};
    if(Math.abs(x)>=hallHalfM-pad-1 && Math.abs(p.northM)>linkHalfM+pad && head>0.)
      return {...p,eastM:site.x+Math.sign(x)*(hallHalfM+pad+2)};
    if(Math.abs(p.northM)>=half-pad-1 && head>0.){
      const station=generateStation(site.address);
      if(!allowed(station,d,p,p,group,0))return {...p,northM:Math.sign(p.northM)*(half+pad+3)};
    }
    return p;
  }
  if(wallDistance(d,p.eastM,p.northM)>=-.002)return p;
  if(!habitatPlot){
    const onStaffedLink=p.eastM>=d.sites[0].x && p.eastM<=d.sites[d.sites.length-1].x && Math.abs(p.northM)<linkHalfM;
    // A verified traveler may occupy the open passage below the slab.
    if((verifiedPassage || onStaffedLink) && p.altitudeM-group.eye+group.body[1]<=site.roofM)return p;
    return {...p,altitudeM:site.roofM+roofSlabM+group.eye};
  }
  const g=districtLocation(d,p.eastM,p.northM),r=d.origin.radiusM;
  const clearance=Math.max(group.body[0],group.body[2])/2+2;
  let closest=null,best=Infinity,homeSide=false;
  // Use physical metres in the local tangent plane. At a junction the diagonals
  // can reach open habitat when a cardinal direction follows another wall.
  for(let bearing=0;bearing<8;bearing++){
    const angle=bearing*Math.PI/4,dx=Math.sin(angle),dz=Math.cos(angle);
    const point=m=>{const ll=unproject(g,dx*m,dz*m,r);return districtPoint(d,ll.latitude,ll.longitude);};
    const free=m=>{const c=point(m);return outsideDistrict(d,c.eastM,c.northM)>clearance;};
    let hi=linkHalfM*1.5;
    while(hi<linkHalfM*12 && !free(hi))hi*=2;
    if(!free(hi))continue;
    let lo=0;
    for(let i=0;i<20;i++){const mid=(lo+hi)/2;if(free(mid))hi=mid;else lo=mid;}
    const ll=unproject(g,dx*hi,dz*hi,r),home=globalThis.SphereAtlas.plotAt(ll.latitude,ll.longitude)?.id===habitatPlot;
    if((home && !homeSide) || (home===homeSide && hi<best)){closest=point(hi);best=hi;homeSide=home;}
  }
  return closest?{...p,...closest}:{...p,altitudeM:site.roofM+roofSlabM+group.eye};
}

export function exteriorMoveAllowed(station,district,from,to){
  const dx=to.eastM-from.eastM,dz=to.northM-from.northM,dy=to.altitudeM-from.altitudeM;
  const distance=Math.hypot(dx,dz,dy);
  if(!distance)return true;
  let travelled=0,p=from;
  while(travelled<distance){
    // Distance to the hall/link union bounds the next possible wall contact.
    // In open country even a long flight step therefore needs a single check.
    if(Math.min(p.altitudeM,to.altitudeM)>station.roofM+roofSlabM+walker.eye && !freightObstruction(station,p,to,walker))return true;
    const gap=outsideDistrict(district,p.eastM,p.northM)-6;
    if(gap>distance-travelled)return true;
    travelled=Math.min(distance,travelled+Math.max(8,gap));
    const t=travelled/distance;
    const next=travelled===distance?to:{eastM:from.eastM+dx*t,northM:from.northM+dz*t,altitudeM:from.altitudeM+dy*t};
    if(!allowed(station,district,p,next,walker,0))return false;
    p=next;
  }
  return true;
}
export function constrainExterior(station,district,from,to){
  if(exteriorMoveAllowed(station,district,from,to))return to;
  let lo=0,hi=1,safe={...from};
  // Travel as far as clearance allows, then spend any remaining displacement
  // along the wall. This keeps a diagonal approach from pinning the walker.
  for(let i=0;i<15;i++){
    const t=(lo+hi)/2,p={};
    for(const axis of ['eastM','northM','altitudeM'])p[axis]=from[axis]+(to[axis]-from[axis])*t;
    if(exteriorMoveAllowed(station,district,from,p)){lo=t;safe=p;}else hi=t;
  }
  // On a remote wall the two Bay 0 coordinate axes are oblique. Sliding along
  // either axis alone moves a pilot sideways even on a head-on impact.
  const withinDistrict=safe.eastM>=district.sites[0].x-hallHalfM && safe.eastM<=district.sites.at(-1).x+hallHalfM
    && Math.abs(safe.northM)<=station.widthM;
  if(!withinDistrict && Math.hypot(safe.eastM,safe.northM)>district.origin.radiusM*.0001){
    const g=districtLocation(district,safe.eastM,safe.northM),r=district.origin.radiusM;
    const local=(e,n)=>{const ll=unproject(g,e,n,r);return districtPoint(district,ll.latitude,ll.longitude);};
    const gap=(e,n)=>{const q=local(e,n);return wallDistance(district,q.eastM,q.northM);};
    const nx=gap(3,0)-gap(-3,0),nz=gap(0,3)-gap(0,-3),squared=nx*nx+nz*nz;
    if(squared>1.){
      const end=districtLocation(district,to.eastM,to.northM),v=project(g,end.latitude,end.longitude,r);
      const normal=(v.eastM*nx+v.northM*nz)/squared;
      const slide={...safe,...local(v.eastM-normal*nx,v.northM-normal*nz)};
      if(exteriorMoveAllowed(station,district,safe,slide))safe=slide;
      const rise={...safe,altitudeM:to.altitudeM};
      return exteriorMoveAllowed(station,district,safe,rise)?rise:safe;
    }
  }
  for(const axis of ['eastM','northM','altitudeM']){
    const p={...safe,[axis]:to[axis]};
    if(exteriorMoveAllowed(station,district,safe,p))safe=p;
  }
  return safe;
}
function allowed(s,d,p,next,group,time){
  const cx=s.address.chainageM,half=s.widthM/2;
  const x=next.eastM-cx,z=next.northM+half,ox=p.eastM-cx,oz=p.northM+half;
  const foot=next.altitudeM-group.eye,head=foot+group.body[1],hw=group.body[0]/2,hl=group.body[2]/2;
  const oldFoot=p.altitudeM-group.eye,h=group.body[1];
  if(freightObstruction(s,p,next,group))return false;
  if(foot>=s.roofM+roofSlabM-.01)return true;
  if(head>0 && intersects(Math.abs(oz-half),Math.abs(z-half),linkHalfM-hl,half+hl)){
    for(const wall of [-hallHalfM,hallHalfM])for(const side of [-1,1]){
      const end=half+side*half,trunk=half+side*linkHalfM;
      if(entersBox(ox,oldFoot,oz,x,foot,z,wall-1-hw,wall+1+hw,-h,s.roofM,Math.min(end,trunk)-hl,Math.max(end,trunk)+hl))return false;
    }
  }
  if(Math.abs(x)<=hallHalfM+hw){
    for(const wall of [0,s.widthM]){
      const face=wall===0?-1:1;
      const out=face*(z-wall),oldOut=face*(oz-wall);
      const doorX=s.routes[0].nearDoor[0],gx=-face*(x-doorX),oldGX=-face*(ox-doorX);
      if(foot<8 && intersects(oldOut,out,-galleryEnd-hl,hl) && intersects(oldGX,gx,-7-hw,7+hw)){
        for(const [lo,hi,bottom,top,front,back] of gallerySolids)
          if(entersBox(oldGX,oldFoot,-oldOut-2,gx,foot,-out-2,lo-hw,hi+hw,bottom-h,top,front-hl,back+hl))return false;
      }
      if(foot<ribs[0][1] && intersects(oldOut,out,-hl,3+hl)){
        const first=Math.ceil((Math.min(ox,x)-hw-ribs[0][0])/ribSpacing);
        const last=Math.floor((Math.max(ox,x)+hw+ribs[0][0])/ribSpacing);
        for(let i=first;i<=last;i++){
          if(!facadeRib(s,i))continue;
          for(const [w,height,front,back] of ribs)
            if(entersBox(ox,oldFoot,oldOut,x,foot,out,i*ribSpacing-w-hw,i*ribSpacing+w+hw,-h,height,1-back-hl,1-front+hl))return false;
        }
      }
      if(!intersects(oz,z,wall-hl-1,wall+hl+1))continue;
      const door=s.routes.find(r=>Math.abs(x-r.nearDoor[0])+hw<=r.door[0]/2+.001 && fits(r,group.body[0],group.body[1]) && head<=r.door[1]+.01 && foot>=-.2);
      if(!door && (entersSlab(oz,z,wall,hl+1) || Math.abs(oz-wall)<hl+1-.0002))return false;
    }
  }
  if((Math.abs(x)>hallHalfM || Math.abs(next.northM)>half+Math.max(hl,hw)+16) && head>0){
    const oldGap=wallDistance(d,p.eastM,p.northM),gap=wallDistance(d,next.eastM,next.northM);
    const pad=Math.max(hl,hw)+1;
    if((oldGap>=0 && gap<pad-.0002 && gap<oldGap-.000001) ||
       (oldGap<0 && gap>-pad+.0002 && gap>oldGap+.000001))return false;
  }
  if(outsideDistrict(d,next.eastM,next.northM)<=0 && !inFreightOpening(x,next.northM,hw,hl) &&
     head>s.roofM && foot<s.roofM+roofSlabM-.01)return false;
  if(foot< s.roofM && Math.abs(x)<hallHalfM){
    const cut=s.routes[2],centre=cut.nearDoor[0],halfWidth=cut.deckWidthM/2;
    if(Math.min(ox,x)-hw<centre+halfWidth && Math.max(ox,x)+hw>centre-halfWidth &&
       intersects(oz,z,-hl,s.widthM+hl)){
      const oldY=deckAt(cut,oz),newY=deckAt(cut,z);
      for(const edge of [centre-halfWidth,centre+halfWidth]){
        // The cut's retaining wall reaches both the rim of the trench and
        // the top of the route's side barrier. Both follow the surveyed ramp.
        const hit=(fromY,toY,bottom,top)=>entersBox(ox,fromY,oz,x,toY,z,edge-hw,edge+hw,bottom,top,-hl,s.widthM+hl);
        if(hit(oldFoot-oldY,foot-newY,-cut.deckDepthM-h,cut.door[1]) || hit(oldFoot,foot,-Infinity,0))return false;
      }
    }
    const rib=Math.round(x/800)*800;
    if(!inFreightOpening(rib,Math.sign(next.northM)*(s.laneHalfM+420)) &&
      !s.routes.some(r=>Math.abs(r.nearDoor[0]-rib)<r.deckWidthM/2+50) && Math.abs(x-rib)<18+hw &&
      Math.abs(Math.abs(next.northM)-(s.laneHalfM+420))<18+hl)return false;
    for(const r of s.routes.slice(0,2)){
      const k=r.id==='service'?1:3,edge=Math.abs(x-r.nearDoor[0]),near=Math.min(z,s.widthM-z);
      if(foot<2.4*k && Math.abs(edge-r.door[0]/2-.45*k)<.22*k+hw &&
         [8,32,80,160,320].some(mark=>Math.abs(near-mark)<.2*k+hl))return false;
      const y=deckAt(r,z),onDeck=Math.abs(x-r.nearDoor[0])<r.deckWidthM/2+hw;
      if(onDeck && foot<y-.15 && head>y-r.deckDepthM && y>r.deckDepthM)return false;
      if(onDeck && Math.abs(Math.abs(next.northM)-(s.laneHalfM+80))<6+hl && foot<r.points[2][1]-r.deckDepthM)return false;
    }
  }
  if(Math.abs(next.northM)<s.laneHalfM+hl && head>-freightSlabDepthM+.001 && foot<-.001)return false;
  if(Math.abs(x)<=hallHalfM+60000 && foot<s.traffic.heightM && head>0 && Math.abs(next.northM)<s.traffic.widthM/2+hl){
    const cargo=freightAt(s,time),center=cargo.x+Math.round((x-cargo.x)/cargo.spacingM)*cargo.spacingM;
    if(intersects(ox,x,center-(cargo.lengthM/2+hw),center+(cargo.lengthM/2+hw)))return false;
  }
  return true;
}
export function move(s,d,pose,group,dx,dz,dy,time,rate=1){
  const horizontal=Math.hypot(dx,dz);
  if(horizontal>1e-8){
    // The long side of a carrier follows its movement; looking around at rest leaves its clearance alone.
    const [w,h,l]=group.body,along=Math.abs(dz)/horizontal,across=Math.abs(dx)/horizontal;
    group={...group,body:[w*along+l*across,h,l*along+w*across]};
  }
  const roof=s.roofM+roofSlabM+group.eye;
  if(pose.mode==='flight' && Math.min(pose.altitudeM,pose.altitudeM+dy)>roof){
    const end={...pose,eastM:pose.eastM+dx,northM:pose.northM+dz,altitudeM:pose.altitudeM+dy};
    if(!freightObstruction(s,pose,end,group))return {pose:end,blocked:''};
  }
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz),Math.abs(dy))/12));
  let p=pose,blocked='';
  for(let i=0;i<steps;i++){
    const next={...p,eastM:p.eastM+dx/steps,northM:p.northM+dz/steps,altitudeM:p.altitudeM+dy/steps};
    const x=next.eastM-s.address.chainageM,z=next.northM+s.widthM/2,foot=p.altitudeM-group.eye;
    const interior=outsideDistrict(d,next.eastM,next.northM)<=0 &&
      !inFreightOpening(x,next.northM,group.body[0]/2,group.body[2]/2),top=s.roofM+roofSlabM;
    // Test entry into the exposed edge of the freight slab before assigning
    // support. A flier halfway up the cut cannot slide onto the track above.
    const trackEdge=s.laneHalfM+group.body[2]/2;
    if(Math.abs(p.northM)>=trackEdge && Math.abs(next.northM)<trackEdge &&
       foot<-.001 && foot+group.body[1]>-freightSlabDepthM+.001){blocked='Clearance limit';break;}
    const ground=support(s,x,z,foot,group,1+Math.hypot(dx,dz)/steps*.055);
    if(p.mode==='walk'){
      if(foot>=top-.1){if(!interior)next.mode='flight';else next.altitudeM=top+group.eye;}
      else if(foot>ground+2 && ground<=0){blocked='Deck edge';break;}
      else next.altitudeM=ground+group.eye;
      const stop=s.laneHalfM+group.body[2]/2+50;
      if(rate>0 && Math.abs(p.northM)>=stop && Math.abs(next.northM)<stop && ground>=0 && ground<1){
        const route=group.id==='trunk'?s.routes[3]:s.floorRoute;
        const crossing={...route,points:[[0,0,0],[0,0,0],[x,0,0]]};
        if(releaseIn(s,time,crossing,{...group,speed:group.speed/rate})>0){blocked='Waiting for scheduled freight';break;}
      }
    }else{
      if(interior && foot>=top-.1 && next.altitudeM<top+group.eye)next.altitudeM=top+group.eye;
      else if(interior && foot<top && next.altitudeM>p.altitudeM)next.altitudeM=Math.min(next.altitudeM,s.roofM-group.body[1]+group.eye-.01);
      if(Math.abs(next.northM)<s.laneHalfM+group.body[2]/2 && foot+group.body[1]<=-freightSlabDepthM+.001)
        next.altitudeM=Math.min(next.altitudeM,-freightSlabDepthM-group.body[1]+group.eye);
      if(next.altitudeM<p.altitudeM){
        for(const r of s.routes){
          if(z<0 || z>s.widthM || Math.abs(x-r.nearDoor[0])+group.body[0]/2>r.deckWidthM/2)continue;
          const deck=deckAt(r,z)+group.eye;
          if(p.altitudeM>=deck && next.altitudeM<=deck)next.altitudeM=deck;
        }
      }
      next.altitudeM=Math.max(next.altitudeM,ground+group.eye);
    }
    if(!allowed(s,d,p,next,group,time)){blocked='Clearance limit';break;}
    if(next.eastM===p.eastM && next.northM===p.northM && next.altitudeM===p.altitudeM)break;
    p=next;
    if(steps>64 && pose.mode==='flight' && (nearestSite(d,p.eastM).address.key!==s.address.key ||
        outsideDistrict(d,p.eastM,p.northM)>3500 || p.altitudeM>24000))break;
  }
  return {pose:p,blocked};
}
