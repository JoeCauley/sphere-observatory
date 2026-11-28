import {packId,sidewalk} from '../packs/infinite-new-york/0.1.0/address.mjs';

export function apartmentRoomPlace(lib){
  const item=lib.entry(packId);
  if(!item)throw Error('Install Infinite New York to visit apartment 1A.');
  return {world:lib.world.key,sceneId:item.id,plotId:item.plotId,label:'Apartment 1A',
    pose:{eastM:-2.42,northM:-5.10,altitudeM:2.33,yaw:2.264,pitch:-.13,mode:'walk'}};
}

export async function prepareApartmentVisit() {
  const app=window.SphereApp,lib=window.SphereBiomeLibrary;
  await Promise.all([lib.ready,window.SphereStageFrame.ready]);
  app.setPlaying(false);
  app.setState({...app.getState(),seed:713,radius:149597870.7,axisLat:63,axisLon:-28,waistWidth:20,
    layoutVersion:2,shadeGeometryRevision:3});
  await lib.selectWorld();
  if(lib.world.key!=='sphere-ed6a59ab491a9a08')throw Error('The Orchard Street pilot needs seed 713.');
  const query=new URLSearchParams(location.search);
  if(query.get('trip')==='date-line'){
    const route=lib.pack('border-transport').placement.districts.find(d=>d.key==='city-marsh');
    const city=lib.placed().find(i=>i.id==='sideways-city');
    const footprint=city?.footprint;
    if(city&&(city.plotId!==route.plots[0]||(footprint&&
      (footprint.shape!=='rectangle'||footprint.east!==1||footprint.north!==1)))){
      throw Error('This save has a different City frontage. Open ?apartment=1A to keep exploring it, or use a fresh register for the Date Line itinerary.');
    }
    // Establish the two ends through the same persistent Atlas operations as
    // the catalogue. Reopening the itinerary reuses its existing addresses.
    if(!lib.placed().some(i=>i.id===packId))await lib.placeRegion(packId,{plotId:'r14c14'});
    if(!lib.placed().some(i=>i.id==='border-transport'))await lib.install('infinite-meadow');
    if(!lib.entry('border-transport'))await lib.install('border-transport');
    if(!city)await lib.placeRegion('sideways-city',{plotId:route.plots[0],footprint:{shape:'rectangle',east:1,north:1}});
    if(!lib.entry('sideways-city'))await lib.install('sideways-city');
    await lib.commissionDistrict(route.plots,route.name);
  }
  const item=lib.entry(packId)??await lib.install(packId);
  if(item.plotId!=='r14c14')throw Error('The Orchard Street plot differs from the expedition register.');
  // Park Main above the requested plot before it prepares its regional renderer.
  // A remembered Meadow landing can otherwise keep it preparing unrelated ground.
  app.setState(lib.overviewPose(item,app.getState()));
  if(query.get('start')==='room')
    return ()=>window.SphereStageFrame.returnToPlace(apartmentRoomPlace(lib));
  let mark=lib.marks().find(m=>m.sceneId===item.id&&m.landmark==='orchard-27-sidewalk');
  if(!mark)mark=await lib.saveMark({world:lib.world.key,sceneId:item.id,plotId:item.plotId,
    landmark:'orchard-27-sidewalk',label:item.name,pose:{...sidewalk}},'27 Orchard Street · Sidewalk');
  return ()=>window.SphereStageFrame.returnToPlace(mark);
}
