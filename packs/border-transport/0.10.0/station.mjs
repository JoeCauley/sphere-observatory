// A station is identified by the two Atlas plots and an integer along their shared edge.
// Local metres use x along the trunk, z across the Border and y above the freight slab.
import {spacingM,stationHash as hash,doorOffset,doorSizes} from './district.mjs';
import {sharedEdge,pointOnEdge} from './edges.mjs';
export const radiusM = 149597870700;
export {spacingM};
export const classes = [
  {id:'service', name:'Service', body:[2.4,3,3], door:doorSizes[0], eye:1.7, maxGrade:.05, speed:1.5, turnM:2},
  {id:'carrier', name:'Carrier', body:[12,10,24], door:doorSizes[1], eye:5, maxGrade:.05, speed:8, turnM:25},
  {id:'heavy', name:'Heavy haul', body:[80,56,150], door:doorSizes[2], eye:28, maxGrade:.025, speed:5, turnM:180},
  {id:'trunk', name:'Monumental', body:[720,480,1200], door:doorSizes[3], eye:230, maxGrade:.012, speed:3, turnM:1500}
];
const layouts = [
  {name:'Viaduct and cut', widthM:40000, laneHalfM:830, shoulderM:1800, bridgeM:630, carrierM:606, underpassM:-112, landingM:350},
  {name:'Transfer yard', widthM:48000, laneHalfM:940, shoulderM:2800, bridgeM:720, carrierM:670, underpassM:-138, landingM:1000},
  {name:'Double gallery', widthM:56000, laneHalfM:1080, shoulderM:3500, bridgeM:765, carrierM:630, underpassM:-148, landingM:1500}
];
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));


export function addressOf(world, sideA, sideB, bay, shellRadiusM=radiusM) {
  if(!(shellRadiusM>0)||!Number.isFinite(shellRadiusM))throw Error('Invalid shell radius');
  if (!/^sphere-[a-f0-9]{16}$/.test(world) || !Number.isSafeInteger(bay)) throw Error('Invalid world or station index');
  const edge=sharedEdge(sideA,sideB,shellRadiusM),chainageM=bay*spacingM;
  if(Math.abs(chainageM)+16000>=edge.lengthM/2)throw Error('Station lies beyond the shared edge');
  const {plots,axis,acrossSign}=edge;
  return {world,radiusM:shellRadiusM,plots,bay,axis,acrossSign,...pointOnEdge(edge,chainageM),chainageM,
    key:world+'/'+edge.id+'/'+bay};
}

// Exponential map in the Atlas latitude/longitude frame. Positive height points into the cavity.
export function surfaceAddress(station,[x,y,z]){
  const a=station.address,r=a.radiusM??radiusM,lo=a.longitude,lat=a.latitude,across=z-station.widthM/2;
  const east=a.axis==='parallel'?x:across*(a.acrossSign??addressOf(a.world,...a.plots,a.bay).acrossSign);
  const north=a.axis==='parallel'?across:x,d=Math.hypot(east,north),angle=d/r;
  if(!d)return {latitude:lat,longitude:lo,radiusM:r-y};
  const co=Math.cos(lat),si=Math.sin(lat),s=Math.sin(angle),c=Math.cos(angle);
  const latitude=Math.asin(Math.max(-1,Math.min(1,si*c+co*s*north/d)));
  return {latitude,longitude:wrap(lo+Math.atan2(s*east/d,co*c-si*s*north/d)),radiusM:r-y};
}

// Bake the resolved geometry on first entry. A stored station remains readable after a rule update.
export function stationDimensions(address){return {widthM:layouts[hash(address.key)%layouts.length].widthM,roofM:1700};}
export function generateStation(address) {
  const seed=hash(address.key), plan=layouts[seed%layouts.length], mid=plan.widthM/2;

  const routes=classes.map((group,i)=>{
    const x=doorOffset(seed,i);
    const y=[plan.bridgeM,plan.carrierM,plan.underpassM,0][i];
    const clear=group.door.slice(), deckWidth=clear[0], deckDepth=[10,28,25,0][i];
    const shoulder=plan.laneHalfM+plan.shoulderM;
    // The ramps end on level landings. All grades, deck heights and door sockets use these vertices.
    const start=600+plan.landingM*(i===1?2:1);
    const pts=[[x,0,0],[x,0,start],[x,y,mid-shoulder],[x,y,mid+shoulder],
      [x,0,plan.widthM-start],[x,0,plan.widthM]];
    return {id:group.id,door:clear,deckWidthM:deckWidth,deckDepthM:deckDepth,points:pts,
      nearDoor:pts[0].slice(),farDoor:pts.at(-1).slice()};
  });
  const service=routes[0],x=service.nearDoor[0];
  const z=mid-plan.laneHalfM*.70,y=service.points[2][1];
  const lookout={x:x+14.4,y,z:z+13.4,west:x+2,east:x+16,near:z-15,far:z+15};
  const lookoutRoute={...service,id:'lookout',points:[...service.points.slice(0,3),
    [x,y,z-13],[x+8,y,z-4],[lookout.x,y,lookout.z],[x+6,y,z+11],[x,y,z+13],...service.points.slice(3)]};
  const floorRoute={id:'floor-service',door:[4,4],deckWidthM:4,deckDepthM:0,
    nearDoor:service.nearDoor.slice(),farDoor:service.farDoor.slice(),
    points:[[x,0,0],[x,0,600],[x+30,0,1100],[x+30,0,plan.widthM-1100],[x,0,plan.widthM-600],[x,0,plan.widthM]]};
  return {schema:1,generator:2,address,layout:plan.name,widthM:plan.widthM,roofM:1700,laneHalfM:plan.laneHalfM,floorRoute,lookout,lookoutRoute,
    routes,traffic:{lengthM:1800,widthM:660,heightM:470,speedMps:4,periodS:5400,
      phaseS:hash([address.world,...address.plots].join('/'))%5400}};
}

const measured=new WeakMap();
function measure(route){
  let result=measured.get(route);
  if(result)return result;
  const segments=[];let length=0;
  for(let i=1;i<route.points.length;i++){
    const a=route.points[i-1],b=route.points[i],d=b.map((v,j)=>v-a[j]),span=Math.hypot(...d);
    if(!span)continue;
    segments.push({a,start:length,end:length+span,unit:d.map(v=>v/span)});length+=span;
  }
  result={segments,length};measured.set(route,result);return result;
}
export function distanceOf(route){return measure(route).length;}
export function atDistance(route,fromNearM){
  const {segments,length}=measure(route),distanceM=Math.max(0,Math.min(length,fromNearM));
  const {a,start,unit}=segments.find(s=>distanceM<=s.end)??segments.at(-1);
  return {position:a.map((v,i)=>v+unit[i]*(distanceM-start)),forward:unit.slice(),distanceM};
}
export function fits(route, width, height) {
  return width>0 && height>0 && width<=route.door[0] && height<=route.door[1];
}

// Analytic timetable on one continuous longitudinal track. All stations share the same world clock.
export function freightAt(station,worldSeconds) {
  const t=station.traffic,span=t.speedMps*t.periodS;
  const phase=((worldSeconds+t.phaseS)*t.speedMps-station.address.chainageM);
  const train=Math.floor((phase+span/2)/span);
  return {x:phase-train*span,train,spacingM:span,y:0,z:station.widthM/2,...t};
}

// Time until an entire transverse vehicle can clear the moving trunk, including both buffers.
export function releaseIn(station,worldSeconds,route,body=classes[3]) {
  if(!['trunk','floor-service'].includes(route.id))return 0;
  const t=station.traffic,x=route.points[2][0],clearS=(2*station.laneHalfM+body.body[2]+100)/body.speed;
  const half=(t.lengthM+body.body[0])/2+50,span=t.speedMps*t.periodS;
  const phase=((worldSeconds+t.phaseS)*t.speedMps-station.address.chainageM-x);
  const sinceOpen=(((phase-half)%span)+span)%span/t.speedMps;
  const window=t.periodS-2*half/t.speedMps;
  if(clearS>window)return Infinity;
  return sinceOpen+clearS<=window ? 0 : t.periodS-sinceOpen;
}

// A transfer already on the live slab keeps its direction until the trailing end clears.
// The timetable and traveler advance on the same clock, including during inspection time-lapse.
export function advanceWalker(station,route,walker,wish,seconds,worldSeconds) {
  if(seconds<0 || !Number.isFinite(seconds) || ![-1,0,1].includes(wish))throw Error('Invalid walk input');
  const body=classes.find(c=>c.id===route.id)||classes[0],length=distanceOf(route);
  const distance=walker.distanceM,dir=walker.transferDirection||wish;
  const next=d=>Math.max(0,Math.min(length,d));
  if(!dir||!seconds)return {...walker,waiting:false};
  const simple=next(distance+dir*seconds*body.speed);
  if(!['trunk','floor-service'].includes(route.id))return {distanceM:simple,transferDirection:0,waiting:false};
  const clearance=station.laneHalfM+body.body[2]/2+50;
  const entry=length/2-dir*clearance,exit=length/2+dir*clearance;
  if(walker.transferDirection){
    if(dir*(simple-exit)<0)return {distanceM:simple,transferDirection:dir,waiting:false};
    const rest=Math.max(0,seconds-Math.abs(exit-distance)/body.speed);
    return {distanceM:wish===dir?next(exit+dir*rest*body.speed):exit,transferDirection:0,waiting:false};
  }
  if(dir*(entry-distance)<-1e-7 || dir*(simple-entry)<0)return {distanceM:simple,transferDirection:0,waiting:false};
  const travel=Math.max(0,dir*(entry-distance))/body.speed;
  const hold=releaseIn(station,worldSeconds+travel,route,body);
  if(travel+hold>=seconds)return {distanceM:entry,transferDirection:0,waiting:hold>0};
  const dest=next(entry+dir*(seconds-travel-hold)*body.speed);
  return {distanceM:dest,transferDirection:dir*(dest-exit)<0?dir:0,waiting:false};
}
