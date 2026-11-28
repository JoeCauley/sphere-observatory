import {mainPose,packPose} from '../../geographic-flight.js';

export function cameraState(host,item,pose){
  const core=host.SphereApp.getState(),s=mainPose(core,item,pose,host.SphereAtlas,host.SphereWorld);
  const fork=item.occurrence.fork;
  const anchor=fork&&Math.hypot(pose.eastM-fork.local.eastM,pose.northM-fork.local.northM)<8000?fork.direction:item.direction;
  return Object.assign(s,{
    siteId:'biome-'+item.occurrence.biome,siteRevision:2,terrainRevision:2,siteElevation:0,
    ...(item.jungleStand?{jungleStand:item.jungleStand}:{}),
    siteAnchor:anchor,terrainAnchor:anchor,geometryDetail:true,collection:true,
    projection:'perspective',viewMode:'material',playing:false,time:host.SphereApp.sceneSeconds
  });
}
export function readCamera(host,item,state,mode){
  const pose=packPose(state,item,host.SphereAtlas,host.SphereWorld,{exactAltitude:true});
  return {...pose,mode};
}
export async function nativeHost(){
  if(parent!==window&&parent.SphereApp)return {host:parent,release(){}};
  const iframe=document.createElement('iframe');
  iframe.setAttribute('aria-hidden','true');iframe.tabIndex=-1;
  Object.assign(iframe.style,{position:'absolute',inset:'0',width:'100%',height:'100%',border:'0',pointerEvents:'none',zIndex:'-1'});
  iframe.src=new URL('../../index.html?habitat-engine=1',import.meta.url);
  document.body.append(iframe);
  const deadline=performance.now()+150000;
  while(!iframe.contentWindow?.sphereHabitatEngineReady){
    if(performance.now()>deadline)throw Error('The native landscape renderer did not open.');
    await new Promise(r=>setTimeout(r,40));
  }
  return {host:iframe.contentWindow,release:()=>iframe.remove()};
}
