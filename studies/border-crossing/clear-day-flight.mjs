import {mainPose,packPose,roofSlabM} from '../../geographic-flight.js';
import {rightSign} from '../../packs/border-transport/0.10.0/district.mjs';
import {stationRecord} from '../../packs/border-transport/0.10.0/atlas.mjs';
import {portals,quayZ} from '../../packs/border-transport/0.10.0/freight-bay.mjs';

// The recorder reads the addressed departure actually opened by the Observatory.
export let departure=null;

export function wallDeparture(){
  return {seed:713,startHeight:36000,approachDegrees:32,ordinaryWall:true};
}

export function freightDeparture(bearing) {
  if(bearing!=='along' && bearing!=='across')throw Error('Choose along or across the freight line.');
  return {seed:713,startHeight:36000,approachDegrees:bearing==='along'?26:45,freightBearing:bearing};
}

// Install and place the observer before the trip. After this point the ordinary
// Main and Border controls own every metre of travel, including the handoff.
export async function prepareClearFlight({seed,startHeight,approachDegrees,freightBearing=null,ordinaryWall=false,serviceDoor=false,forestWalk=false}) {
  const library=window.SphereBiomeLibrary, app=window.SphereApp;
  await library.ready;
  if(forestWalk)await SphereStageFrame.ready;
  app.setPlaying(false);
  const survey=(freightBearing||ordinaryWall)?{radius:149597870.7,axisLat:63,axisLon:-28,waistWidth:20,layoutVersion:2,
    shadeGeometryRevision:3,shadeFractureRevision:2,collection:true,fov:80,projection:'perspective',viewMode:'material'}:{};
  app.setState({...app.getState(),...survey,seed,clouds:false,weatherStrength:0,cavityHaze:0,atmosphere:1,routeShades:true});
  await library.selectWorld();
  for(const id of ['infinite-meadow','border-transport']){
    if(!library.entry(id))await library.install(id);
  }
  if(forestWalk&&!library.entry('super-jungle'))await library.install('super-jungle');
  const item=library.entry('border-transport'),site=item.transport.sites.find(s=>s.bay===0);
  const rules=library.pack(item.id).atmosphereRules;
  const neighbour=item.transport.sites.find(s=>s.bay===1)??item.transport.sites.find(s=>s.bay===-1);
  if(ordinaryWall && !neighbour)throw Error('This edge has no surveyed interstation reach.');
  const center=ordinaryWall?{eastM:site.x+.47*(neighbour.x-site.x),northM:680,altitudeM:site.roofM+roofSlabM+1.7}:freightBearing?{eastM:site.x+7010,northM:quayZ-40,altitudeM:4500}:
    {eastM:site.x-15000,northM:-site.widthM/2+1500,altitudeM:site.roofM+roofSlabM+1.7};
  const landmark=freightBearing?{x:site.x+portals[1],z:0,h:site.roofM+1150}:
    {x:site.x-16000,z:-site.widthM/2,h:site.roofM+roofSlabM};
  const yaw=ordinaryWall?Math.sign(neighbour.x-site.x)*1.55:freightBearing?(freightBearing==='along'?Math.PI/2:0):
    Math.atan2(landmark.x-center.eastM,landmark.z-center.northM);
  const pitch=-approachDegrees*Math.PI/180,run=(startHeight-center.altitudeM)/Math.tan(-pitch);
  const start={eastM:center.eastM-run*Math.sin(yaw),northM:center.northM-run*Math.cos(yaw),
    altitudeM:startHeight,yaw,pitch,mode:'flight'};
  const state=app.getState(),at=local=>mainPose(state,item,local,SphereAtlas,SphereWorld);
  const high=at(start),low=at({...center,yaw,pitch,mode:'flight'});
  const model=freightBearing?(await stationRecord(site.address,false,library.persistence==='file')).station:null;
  const period=model?model.traffic.periodS:900;
  const firstTime=model?(center.eastM+370)/model.traffic.speedMps-model.traffic.phaseS:0;
  let day;
  for(let elapsed=0;elapsed<=7*24*3600;elapsed+=period){
    const time=firstTime+elapsed;
    const direct=Math.min(...[low,high].map(s=>SphereCollection.visibility(s.position,{...s,time},64)));
    if(!day || day.direct<direct)day={time,direct};
    if(direct>=.98)break;
  }
  if(day.direct<.95)throw Error('The station remained in shade during the study window.');
  app.setState({...high,time:day.time,playing:false,autoSpeed:false,speed:1.8,...(model?{timeRate:1}:{})});
  app.draw();
  departure={item,site,model,meta:{seed,world:library.world.key,address:site.address.key,center,landmark,start,day,
    rules,freightBearing,ordinaryWall,hand:rightSign(item.transport)}};
  if(serviceDoor){
    const meadow=library.entry('infinite-meadow');
    const side=site.address.plots.indexOf(meadow.plotId);
    if(side<0)throw Error('The selected station has no Meadow frontage.');
    const {station}=await stationRecord(site.address,false,library.persistence==='file');
    const door=side===0?station.routes[0].nearDoor:station.routes[0].farDoor;
    const sign=side===0?-1:1;
    const row=forestWalk?SphereStageFrame.transportAddress()?.rows.find(r=>r.site.address.key===site.address.key):null;
    if(forestWalk&&!row?.verge?.start)throw Error('The installed Meadow has no planted service frontage at Bay 0.');
    const view=at(row?.verge?.start??{eastM:site.x+door[0],northM:sign*(site.widthM/2+24),altitudeM:1.7,
      yaw:side===0?0:Math.PI,pitch:.015,mode:'walk'});
    app.setState({...view,time:day.time,playing:false,...(forestWalk?{timeRate:1}:{})});
    departure.enterServiceApproach=async()=>{
      const pose=packPose({...view,walkMode:true},meadow,SphereAtlas,SphereWorld);
      const q=SphereMath.norm(view.position);
      if(!await SphereStageFrame.walkGround({q,forward:view.forward,id:meadow.id,pack:true},null,pose))
        throw Error('The Meadow service approach could not be opened.');
      app.setPlaying(true);
    };
  }
  return departure;
}
