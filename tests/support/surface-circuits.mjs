import {circleThrough,planWalk,createWalker} from '../../surface-circuit.js';
import {along,ownerAt} from '../../surface-passages.js';
import {unproject} from '../../packs/kit/surface-route.js';
export const seed=0x5eefa113;
// The 18-degree waist puts its habitat boundaries between Atlas grid rows.
// This axis leaves intact courses through the surveyed Violet and Jungle groves.
export const circuitWorld={axisLat:20,axisLon:60,waistWidth:18};
export const circuitPlots={
  'infinite-meadow':{plotId:'r12c35',footprint:{shape:'rectangle',east:.75,north:1}},
  'infinite-industry':{plotId:'r7c21',footprint:{shape:'rectangle',east:.72,north:.75}},
  'infinite-new-york':{plotId:'r14c14',footprint:{shape:'rectangle',east:.72,north:.75}}
};
// The default-world survey found native Violet and Mycelium on
// opposite sides of an uninterrupted interstation wall.
export const blockedWallCourse={
  origin:[-.850615680405724,-.37106170980838205,.3725133175632616],
  forward:[.3798316737303901,.05623698766440932,.9233446273464763],
  normal:[-.3635668630102002,.9269037753362067,.09310492676764824],
  mouth:[-.6692969622619067,-.3294191803772509,.6659764109235132]
};
// This observed edge sent the nominal outlet into a real Sideways City building.
export const blockedCityDoor={
  plotId:'r13c0',q:[.8060144611225651,.21378904750841138,.5519374345220183],
  forward:[.557290311034206,.040065403616209874,-.8293505125460937]
};
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=q=>q.map(x=>x/Math.hypot(...q));
function check(ok,why){if(!ok)throw Error(why);}

// Start just beyond the equatorial grid wall without changing the orbit plane.
function leaveEquator(circle,state){
  const at=along(circle.origin,circle.forward,25/state.radius);
  return {...circle,origin:at.q,forward:at.forward};
}
// A visitor on the default world can walk this bearing through ten native
// habitats even with the complete Atlas wall and every detail pack installed.
export function defaultCircuit(state,items,env){
  const radians=Math.PI/180;
  const circle=leaveEquator(circleThrough(0,12*radians,84*radians,state,env.world),state);
  const plan=planWalk(circle,state,items,env);
  check(plan,'The surveyed 84-degree default-world course is obstructed');
  return {...plan,label:'Default world, 84-degree bearing'};
}

export function circuits(state,items,env,routeSeed=seed){
  const roll=random(routeSeed),routes=[],covered=new Set();
  const straightSites=items.filter(i=>!i.transport),hasBorder=straightSites.length!==items.length;
  const required=[...straightSites.map(i=>i.id),...env.world.names.slice(0,13).map((_,i)=>'main-'+i),'main-15'];
  const record=plan=>{
    for(const leg of plan.legs){if(leg.owner)covered.add(leg.owner.id);if(leg.installation)covered.add(leg.installation);}
    routes.push(plan);
  };
  function choose(target,label,through,requireNew=false,occurrence=null){
    for(let i=0;i<2000;i++){
      let at=target??{latitude:0,longitude:(roll()*2-1)*Math.PI};
      if(occurrence&&i%2===1){
        // A course through the habitat may clear a hall even when every line
        // through the habitat's center would run into the building.
        const bearing=roll()*2*Math.PI, radius=state.radius*1000;
        const offset=radius*occurrence.angularRadius*Math.sqrt(roll());
        at=unproject(occurrence,offset*Math.sin(bearing),offset*Math.cos(bearing),radius);
      }
      const circle=circleThrough(at.latitude,at.longitude,roll()*2*Math.PI,state,env.world);
      const plan=planWalk(hasBorder?leaveEquator(circle,state):circle,state,items,env);
      if(!plan)continue;
      if(through && !plan.legs.some(leg=>leg.owner?.id===through || leg.installation===through))continue;
      if(requireNew && !plan.legs.some(leg=>leg.owner && !covered.has(leg.owner.id)))continue;
      plan.label=label;record(plan);return;
    }
    throw Error('Could not find a complete supported course through '+label);
  }
  for(let i=0;i<3;i++)choose(null,'Random equatorial bearing '+(i+1));
  for(const item of straightSites){
    const at=item.occurrence?.fork??item.occurrence??item.edge??env.atlas.byId(item.plotId);
    choose(at,item.name,item.id,false,item.occurrence);
  }
  for(let i=0;i<required.length&&required.some(id=>!covered.has(id));i++)choose(null,'Additional equatorial bearing '+(i+1),null,true);
  check(required.every(id=>covered.has(id)),'Unvisited regions '+required.filter(id=>!covered.has(id)));
  return routes;
}

export function runCircuit(plan,state,items,env){
  const walker=createWalker(plan),roll=random(seed),counts={ground:0,tunnel:0},visits=new Set(),turn=2*Math.PI;
  let distanceKm=0,swept=0,steps=0,previous=plan.circle.origin;
  while(!walker.done){
    // At 2.8 m/s these ticks span many simulated years. No tick may skip a support change.
    const elapsedSeconds=(.25+roll())*6e8;
    const step=walker.advance(elapsedSeconds*.0028),q=unit(step.position);
    check(step.mode==='walk','Lost walking mode');
    check(step.distance<=elapsedSeconds*.0028+.000001,'Walk exceeded clock');
    swept+=Math.atan2(dot(plan.circle.normal,cross(previous,q)),dot(previous,q));previous=q;
    if(step.leg.kind==='ground'){
      if(!step.end)check(ownerAt(q,state,items,env.atlas,env.world).id===step.leg.owner.id,'Missed a habitat near '+step.leg.owner.name);
      check(Math.abs(Math.hypot(...step.position)-state.radius)<.000001,'Left the shell');
      check(!env.math.inBreach(q,state)&&!env.collection.missing(q,state),'Crossed an open wound');
      visits.add(step.leg.owner.id);
    }else if(step.leg.installation)visits.add(step.leg.installation);
    if(step.end)counts[step.leg.kind]++;
    steps++;distanceKm+=step.distance;
  }
  const closureM=1000*state.radius*distance(unit(walker.position),plan.circle.origin);
  check(closureM<.01,'Closure exceeded 1 cm: '+closureM);
  check(Math.abs(swept-turn)<1e-10,'Incomplete signed revolution');
  check(Math.abs(distanceKm-plan.legs.reduce((a,l)=>a+l.km,0))<.00001,'Lost travel distance');
  return {label:plan.label,inclinationDeg:plan.circle.inclination,lengthKm:distanceKm,sweptDegrees:swept*180/Math.PI,closureM,steps,...counts,visits:[...visits]};
}
