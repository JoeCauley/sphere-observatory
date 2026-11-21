import {classes,freightAt,fits,releaseIn} from './station.mjs';
import {hallHalfM,linkHalfM,outsideDistrict,roofSlabM} from './district.mjs';

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
    if(Math.abs(foot-h)<=step)return h;
  }
  return 0;
}
function intersects(a,b,lo,hi){return Math.min(a,b)<=hi && Math.max(a,b)>=lo;}
function allowed(s,d,p,next,group,time){
  const cx=s.address.chainageM,half=s.widthM/2;
  const x=next.eastM-cx,z=next.northM+half,ox=p.eastM-cx,oz=p.northM+half;
  const foot=next.altitudeM-group.eye,head=foot+group.body[1],hw=group.body[0]/2,hl=group.body[2]/2;
  if(foot>=s.roofM+roofSlabM-.01)return true;
  if(Math.abs(x)<=hallHalfM+hw){
    for(const wall of [0,s.widthM]){
      if(!intersects(oz,z,wall-hl-1,wall+hl+1))continue;
      const door=s.routes.find(r=>Math.abs(x-r.nearDoor[0])+hw<=r.door[0]/2+.001 && fits(r,group.body[0],group.body[1]) && head<=r.door[1]+.01 && foot>=-.2);
      if(!door)return false;
    }
  }
  if(Math.abs(x)>hallHalfM && next.eastM>d.sites[0].x && next.eastM<d.sites.at(-1).x){
    for(const side of [-1,1])if(intersects(p.northM,next.northM,side*linkHalfM-hl-1,side*linkHalfM+hl+1))return false;
  }
  if(outsideDistrict(d,next.eastM,next.northM)<=0 && head>s.roofM && foot<s.roofM+roofSlabM-.01)return false;
  if(foot< s.roofM && Math.abs(x)<hallHalfM){
    const rib=Math.round(x/800)*800;
    if(!s.routes.some(r=>Math.abs(r.nearDoor[0]-rib)<r.deckWidthM/2+50) && Math.abs(x-rib)<18+hw &&
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
  if(foot<0 && Math.abs(next.northM)<s.laneHalfM && head>-24 && foot<-.1)return false;
  if(foot< s.traffic.heightM && head>0 && Math.abs(next.northM)<s.traffic.widthM/2+hl){
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
  if(pose.mode==='flight' && Math.min(pose.altitudeM,pose.altitudeM+dy)>roof)
    return {pose:{...pose,eastM:pose.eastM+dx,northM:pose.northM+dz,altitudeM:pose.altitudeM+dy},blocked:''};
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz),Math.abs(dy))/12));
  let p=pose,blocked='';
  for(let i=0;i<steps;i++){
    const next={...p,eastM:p.eastM+dx/steps,northM:p.northM+dz/steps,altitudeM:p.altitudeM+dy/steps};
    const x=next.eastM-s.address.chainageM,z=next.northM+s.widthM/2,foot=p.altitudeM-group.eye;
    const interior=outsideDistrict(d,next.eastM,next.northM)<=0,top=s.roofM+roofSlabM;
    const ground=support(s,x,z,foot,group,1+Math.hypot(dx,dz)/steps*.055);
    if(p.mode==='walk'){
      if(foot>=top-.1){if(!interior)next.mode='flight';else next.altitudeM=top+group.eye;}
      else if(foot>ground+2 && ground===0){blocked='Deck edge';break;}
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
    p=next;
  }
  return {pose:p,blocked};
}
