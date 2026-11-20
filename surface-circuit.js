import {along,ownerAt,passageAt,passagePoint,tunnelLength} from './surface-passages.js';
import {tunnelStart,moveBody,solidAt,supportAt} from './packs/border-outfall/1.0.0/border.js';
import {makeGallery} from './packs/border-outfall/1.0.0/geometry.js';
import {eye} from './packs/border-outfall/1.0.0/model.js';
import {canStand} from './portal-landing.js';

const turn=2*Math.PI, dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>v.map(x=>x/Math.hypot(...v)), wrap=a=>(a%turn+turn)%turn;
const lengthKm=tunnelLength/1000;
let gallery;

// Start at the ascending equatorial node of the plane through the chosen point and bearing.
export function circleThrough(latitude,longitude,bearing,state,world) {
  const {axis}=world.frame(state),q=world.direction(latitude,longitude,state);
  const east=unit(cross(axis,q)),north=cross(q,east);
  const tangent=north.map((n,i)=>n*Math.cos(bearing)+east[i]*Math.sin(bearing));
  const normal=unit(cross(q,tangent)),line=cross(axis,normal);
  const origin=Math.hypot(...line)>1e-12?unit(line):q,forward=unit(cross(normal,origin));
  return {origin,forward,normal,inclination:Math.acos(Math.min(1,Math.abs(dot(normal,axis))))*180/Math.PI};
}
function intersections(circle,plane,offset=0) {
  const x=dot(circle.origin,plane),y=dot(circle.forward,plane),r=Math.hypot(x,y);
  if(r<1e-14 || Math.abs(offset)>r)return [];
  const c=Math.atan2(y,x),d=Math.acos(Math.max(-1,Math.min(1,offset/r)));
  return [wrap(c-d),wrap(c+d)];
}
function cutsFor(circle,state,items,{world,atlas}) {
  const cuts=[0,turn],frame=world.frame(state);
  const latitude=lat=>cuts.push(...intersections(circle,frame.axis,Math.sin(lat)));
  const longitude=lon=>cuts.push(...intersections(circle,world.direction(0,lon+Math.PI/2,state)));
  const w=state.waistWidth*Math.PI/180;
  for(const lat of [-1.31,-w,-w/3,0,w/3,w,1.31])latitude(lat);
  for(let i=0;i<8;i++)longitude(i*turn/8-Math.PI);
  for(const item of items){
    const plot=atlas.byId(item.plotId||item.edge?.near);if(!plot)continue;
    latitude(plot.latitude-plot.halfHeight);latitude(plot.latitude+plot.halfHeight);
    longitude(plot.longitude-Math.PI/plot.columns);longitude(plot.longitude+Math.PI/plot.columns);
  }
  for(const lon of world.habitatMeridians())longitude(lon);
  return cuts.sort((a,b)=>a-b).filter((a,i,list)=>!i||a-list[i-1]>1e-12);
}
// Prove a whole great circle clears the damaged shell. Reject uncertain grazing courses.
// At most 'half' radians separate a point in an interval from its midpoint.
function intact(circle,state,{math,collection}) {
  if(state.breachEnabled){
    const axis=math.axis(state.breachLat,state.breachLon);
    const chord=2*Math.sin(state.breachDiameter/(4*state.radius))*(1+.2*Math.abs(state.breachRoughness||0));
    if(Math.abs(dot(axis,circle.normal))<=Math.sin(2*Math.asin(Math.min(1,chord/2))))return false;
  }
  if(state.era!=='after'||!state.multipleWounds)return true;
  for(const wound of collection.wounds){
    if(Math.abs(dot(wound.axis,circle.normal))>Math.sin(wound.length+wound.width*1.185))continue;
    const up=cross(wound.axis,wound.tangent);
    const clear=(angle,half)=>{
      const q=along(circle.origin,circle.forward,angle).q,b=Math.asin(Math.max(-1,Math.min(1,dot(q,up))));
      const bMin=Math.max(0,Math.abs(b)-half);
      if(bMin>wound.width*1.185)return true;
      const a=Math.atan2(dot(q,wound.tangent),dot(q,wound.axis));
      const da=half/Math.max(.001,Math.cos(Math.min(Math.PI/2,Math.abs(b)+half)));
      const aMin=Math.max(0,Math.abs(a)-da);
      const jag=1+.13*Math.sin(71*a)+.055*Math.sin(193*a);
      const maxJag=Math.min(1.185,jag+(.13*71+.055*193)*da);
      if(Math.hypot(aMin/wound.length,bMin/(wound.width*maxJag))>1)return true;
      if(collection.woundDistance(q,wound)<=1||half<1e-8)return false;
      return clear(angle-half/2,half/2)&&clear(angle+half/2,half/2);
    };
    for(let i=0;i<16;i++)if(!clear((i+.5)*turn/16,turn/32))return false;
  }
  return true;
}
export function planWalk(circle,state,items,env) {
  if(!intact(circle,state,env))return null;
  const at=a=>along(circle.origin,circle.forward,a);
  const ground=a=>ownerAt(at(a).q,state,items,env.atlas,env.world);
  const cuts=cutsFor(circle,state,items,env),regions=[];
  for(let i=1;i<cuts.length;i++){
    const a=cuts[i-1],b=cuts[i],owner=ground((a+b)/2);
    if(regions.at(-1)?.owner.id===owner.id)regions.at(-1).end=b;
    else regions.push({start:a,end:b,owner});
  }
  // A blended material may keep the same dominant ID a few metres beyond its
  // mathematical meridian. Locate the exact change reported by the live walker.
  const interior=regions.map(r=>(r.start+r.end)/2);
  for(let i=1;i<regions.length;i++){
    const previous=regions[i-1],next=regions[i];
    let low=interior[i-1],high=interior[i];
    for(let pass=0;pass<55;pass++){
      const mid=(low+high)/2,id=ground(mid).id;
      if(id===previous.owner.id)low=mid;
      else if(id===next.owner.id)high=mid;
      else return null;
    }
    previous.end=next.start=(low+high)/2;
  }
  const angle=2*Math.asin(lengthKm/2/state.radius),legs=[];
  const edges=items.filter(i=>i.edge).map(i=>({item:i,q:env.world.direction(i.edge.latitude,i.edge.longitude,state)}));
  for(let i=0;i<regions.length;i++){
    const region=regions[i],previous=regions[(i+regions.length-1)%regions.length];
    let a=region.start;
    if(previous.owner.id!==region.owner.id){
      if(region.end-a<=angle)return null;
      const p=at(a),gate=passageAt(p.q,p.forward,state.radius);
      gate.near={...gate.near,...previous.owner};gate.far={...gate.far,...region.owner};
      const opening=edges.find(v=>Math.hypot(...p.q.map((x,j)=>x-v.q[j]))*state.radius*1000<5);
      legs.push({kind:'tunnel',start:a,end:a+angle,km:lengthKm,gate,installation:opening?.item.id??null});
      a+=angle;
    }
    legs.push({kind:'ground',owner:region.owner,start:a,end:region.end,km:(region.end-a)*state.radius});
  }
  // A certified great circle cannot turn to avoid a building. Demand clear
  // native support at each accelerated footfall and at every fixed portal.
  for(const [index,leg] of legs.entries()){
    if(leg.kind==='tunnel'){
      if(!canStand(leg.gate.far.q,leg.gate.far.id,state,items,env,.8))return null;
    }else if(leg.owner.pack){
      const end=leg.end-(legs[index+1]?.kind==='tunnel' ? .001/state.radius : 0);
      for(const angle of [leg.start,(leg.start+leg.end)/2,end]){
        if(!canStand(at(angle).q,leg.owner.id,state,items,env,.8))return null;
      }
    }
  }
  return {circle,radius:state.radius,legs};
}
// A clock may request days or centuries. Stop on every change of support and carry unused time forward.
export function createWalker(plan) {
  const {circle,radius,legs}=plan;
  let index=0,inLeg=0,km=0,body=null,gate=null;
  let point={q:circle.origin.slice(),forward:circle.forward.slice()},position=point.q.map(x=>x*radius);
  function advance(availableKm) {
    if(!Number.isFinite(availableKm)||availableKm<0)throw RangeError('Expected a finite walking distance.');
    const leg=legs[index];if(!leg)return null;
    const left=leg.km-inLeg,distance=Math.min(left,availableKm);
    inLeg=distance===left?leg.km:inLeg+distance;
    if(leg.kind==='tunnel'){
      gallery??=makeGallery().colliders;
      gate??=passageAt(point.q,point.forward,radius);
      body??={eastM:-1,northM:tunnelStart,altitudeM:eye,yaw:0,pitch:0,mode:'walk'};
      moveBody(body,gallery,0,0,distance*1000);
      if(body.mode!=='walk'||Math.abs(body.northM-tunnelStart-inLeg*1000)>.001 ||
        solidAt(gallery,body.eastM,body.altitudeM,body.northM)||Math.abs(supportAt(gallery,body)-eye)>.0001)
        throw Error('The through-tunnel lost walking support.');
      position=passagePoint(gate,inLeg*1000,radius);
      if(inLeg===leg.km)point=gate.far;
    }else{
      point=along(point.q,point.forward,distance/radius);
      position=point.q.map(x=>x*radius);
    }
    km+=distance;
    const end=inLeg===leg.km,result={index,leg,inLeg,km,distance,end,position:position.slice(),mode:'walk'};
    if(end){index++;inLeg=0;body=null;gate=null;}
    return result;
  }
  return {advance,get done(){return index===legs.length;},get km(){return km;},get position(){return position.slice();}};
}
