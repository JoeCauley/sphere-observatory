import {installedEdge,districtPoint,roofSlabM} from '../../packs/border-transport/0.10.0/district.mjs';
import {pointOnEdge} from '../../packs/border-transport/0.10.0/edges.mjs';

export async function openWallRoute(route){
  const library=window.SphereBiomeLibrary,stage=window.SphereStageFrame,app=window.SphereApp;
  const district=library.entry('border-transport').transport,bay=district.sites.find(s=>s.bay===1);
  if(!bay)throw Error('Bay +1 is missing from this survey.');
  let pose={eastM:bay.x+12000,northM:-430,altitudeM:2691.6,yaw:Math.PI/2,pitch:-.018,mode:'flight'};
  if(route==='junction'){
    const edge=installedEdge(district),end=pointOnEdge(edge,edge.lengthM/2);
    const at=districtPoint(district,end.latitude,end.longitude);
    // Start on the meridian looking toward the arm that runs east at the junction.
    pose={...pose,eastM:at.eastM-9000,northM:at.northM,altitudeM:bay.roofM+roofSlabM+450,yaw:Math.PI/2,pitch:-.05};
  }
  app.chooseFlightSpeed(false,2);app.setPlaying(false);
  app.setState({...app.getState(),playing:false,time:44101.062,fov:103});
  const result=await stage.open('border-transport',{entry:{geographic:true,active:false,pose,horizontalFov:103}});
  if(!['taken-over','arrived'].includes(result?.status))throw Error('The geographic roof route could not open.');
  app.setPlaying(true);
  document.querySelector('#stageFrame iframe')?.contentDocument?.querySelector('canvas')?.focus();
}
