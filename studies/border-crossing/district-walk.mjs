import {mainPose,packPose,borderFrontage,installedEdge} from '../../geographic-flight.js';
import {stationRecord} from '../../packs/border-transport/0.10.0/atlas.mjs';

export async function prepareDistrictWalk(key){
  const lib=window.SphereBiomeLibrary,app=window.SphereApp,stage=window.SphereStageFrame;
  await Promise.all([lib.ready,stage.ready]);
  const source=lib.pack('border-transport').placement.districts.find(entry=>entry.key===key);
  if(!source)throw Error('This station survey is unavailable.');
  app.setPlaying(false);
  app.setState({...app.getState(),radius:149597870.7,axisLat:63,axisLon:-28,waistWidth:20,layoutVersion:2,
    seed:source.seed,shadeGeometryRevision:3,shadeFractureRevision:2,collection:true,fov:75,projection:'perspective',
    viewMode:'material',clouds:false,weatherStrength:0,cavityHaze:0,routeShades:true});
  await lib.selectWorld();
  if(!lib.entry('border-transport'))await lib.install('border-transport');
  const border=await lib.commissionDistrict(source.plots,source.name),d=border.transport;
  const {station}=await stationRecord(d.origin,false,lib.persistence==='file');
  const along=station.routes[0].nearDoor[0],setback=station.widthM/2+125,state=app.getState();
  const outside=borderFrontage(installedEdge(d),0,along,setback,lib.placed(),lib.pack,
    (lat,lon)=>SphereWorld.sample(SphereWorld.direction(lat,lon,state),state));
  const pose={eastM:along,northM:-setback,altitudeM:1.7,yaw:0,pitch:.018,mode:'walk'};
  const camera=mainPose(state,border,pose,SphereAtlas,SphereWorld);
  camera.time=0;
  while(camera.time<86400 && SphereCollection.visibility(camera.position,camera,64)<.97)camera.time+=600;
  app.setState({...camera,playing:false,timeRate:1,walkMode:false});
  return async()=>{
    const item=outside.canEnterPack?lib.entry(outside.instanceId):null;
    const point={q:SphereMath.norm(camera.position),forward:camera.forward,id:item?.id,pack:!!item};
    const entry=item?packPose({...camera,walkMode:true},item,SphereAtlas,SphereWorld):null;
    if(!await stage.walkGround(point,null,entry))throw Error('The station approach could not be opened.');
    app.setPlaying(true);
  };
}
