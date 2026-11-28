import {millPlace} from '../packs/infinite-industry/1.4.1/mill-site.js';
import {millAddress} from '../packs/kit/rolling-mill.mjs';
import {transfer} from '../packs/infinite-industry/1.4.1/transfer.js';

export async function prepareMillVisit() {
  const app=window.SphereApp,lib=window.SphereBiomeLibrary;
  await Promise.all([lib.ready,SphereStageFrame.ready]);
  app.setPlaying(false);
  app.setState({...app.getState(),seed:713,radius:149597870.7,axisLat:63,axisLon:-28,waistWidth:20,
    layoutVersion:2,shadeGeometryRevision:3,timeRate:1});
  await lib.selectWorld();
  const world=lib.world.key;
  if(world!=='sphere-ed6a59ab491a9a08')throw Error('The R1 rolling mill needs seed 713.');
  if(!lib.placed().some(i=>i.id==='infinite-industry'))await lib.placeRegion('infinite-industry',{plotId:'r7c21'});
  const item=lib.entry('infinite-industry')??await lib.install('infinite-industry');
  if(item.plotId!=='r7c21')throw Error('This save has a different Industry site. Open the Observatory to visit it or use a fresh register for R1.');
  const address=millAddress(world,item.id,transfer.destination);
  let mark=lib.marks().find(m=>m.equipment===address);
  if(!mark)mark=await lib.saveMark({world,sceneId:item.id,plotId:item.plotId,label:item.name,
    equipment:address,pose:millPlace()},'R1 · Rolling mill');
  return async()=>{
    const clock=await SphereProduction.select(world);
    if(!clock?.ready)throw Error(clock?.error||'The mill journal could not be opened.');
    await SphereStageFrame.returnToPlace(mark);
    // Newly commissioned bays start live. Existing production reopens on pause,
    // so reading the rack or a partially rolled job costs no simulated time.
    app.setPlaying(!clock.state.machines[address]);
  };
}
