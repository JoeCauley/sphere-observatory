import {bridgeWindTick, createBridgeBiome, projectAperture} from '../../kit/bridge-biome.mjs';
import {galleryBoxes} from '../../kit/outfall-gallery.mjs';
import {apronRunM,roofSlabM} from './district.mjs';

// Only the two continuous side walls can conceal the entire service opening.
// Use their surveyed dimensions, including their two-metre setback from the jamb.
const sideWalls=galleryBoxes.filter(box=>box[8] && box[5]>10);
const liveRadiusM=65,releaseRadiusM=100;
const distanceToDoor=(eye,door)=>Math.hypot(Math.max(0,door.xMin-eye[0],eye[0]-door.xMax),
  Math.max(0,eye[1]-door.yMax,door.yMin-eye[1]),eye[2]-door.z);

function hiddenBySideWall(eye,door){
  const ex=eye[0]-door.x,y=eye[1],depth=(door.z-eye[2])*door.side;
  if(depth<=2 || y<0)return false;
  for(const [x,cy,cz,width,height,length] of sideWalls){
    if(y>cy+height/2)continue;
    const side=Math.sign(-door.side*x),inner=Math.abs(x)-width/2;
    const atStart=(2+cz-length/2)/depth,atEnd=Math.min(1,(2+cz+length/2)/depth);
    if(atStart>=atEnd)continue;
    // Project the whole horizontal interval at each end of this solid slab.
    const outerEdge=side*ex*atStart+door.halfWidth*(1-atStart);
    const innerEdge=side*ex*atEnd-door.halfWidth*(1-atEnd);
    if(outerEdge<inner && innerEdge>inner)return true;
  }
  return false;
}

export function makeMeadowDoor(gl,resolve,invalidate,readWind){
  let descriptor=null,doors=[],door=null,controller=null,provider=null,loading=false,error='',dead=false,live=false,needed=false;
  const ramp=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  function release(){
    controller?.dispose();controller=null;live=false;
  }
  function selectDoor(eye){
    // The monumental jamb can be half a kilometre from the door centre. Hold
    // only the opening within reach, including during short reversals.
    const next=doors.find(d=>distanceToDoor(eye,d)<=liveRadiusM)
      ??(door && distanceToDoor(eye,door)<=releaseRadiusM?door:doors[0]);
    if(next!==door){release();door=next;error='';}
  }
  function fetchProvider(){
    if(provider||loading||error)return;
    loading=true;
    import('../../kit/meadow-bridge.mjs').then(module=>{
      provider=module.createMeadowBridge;
    }).catch(reason=>{error=String(reason.message||reason);}).finally(()=>{
      loading=false;
      if(!dead)invalidate();
    });
  }
  return {
    load(station,enabled=true){
      const next=enabled?resolve(station):null;
      if(next===descriptor)return;
      release();descriptor=next;door=null;doors=[];error='';needed=false;
      if(!next)return;
      doors=station.routes.map(route=>{
        const [x,y,z]=next.side<0?route.nearDoor:route.farDoor;
        const halfWidth=route.door[0]/2;
        return {key:station.address.key+'/'+route.id+'/'+next.side,route:route.id,side:next.side,x,z,halfWidth,
          xMin:x-halfWidth,xMax:x+halfWidth,yMin:y,yMax:y+route.door[1]};
      });
      door=doors[0];
    },
    get route(){return door?.route;},
    roofWeight(station,eye){
      if(!descriptor || eye[1]<=station.roofM)return 0;
      // Across the roof the two frontages meet at midspan. Above the near
      // flight band, hand the distant view back to the district survey.
      const mid=station.widthM/2,frontage=(eye[2]-mid)*descriptor.side;
      const rise=eye[1]-station.roofM;
      return ramp(rise/roofSlabM)*ramp(frontage/apronRunM)*(1-ramp((rise-apronRunM)/apronRunM));
    },
    get animationTime(){return live?readWind():controller?.watchWind?bridgeWindTick(readWind()):null;},
    get pending(){return needed && !error && !provider;},
    get error(){return needed?error:'';},
    retry(){release();error='';invalidate();},
    get stats(){return {...(controller?.stats??{phase:'idle',residentBytes:0,provider:null,captureCount:0,reuseCount:0,
      drawCount:0,releaseCount:0,directCount:0,activeKey:null,width:0,height:0}),loading,error};},
    exterior(eye){
      if(descriptor?.doorsEnabled===false)return false;
      selectDoor(eye);
      return !!door && (eye[2]-door.z)*door.side>=0 && distanceToDoor(eye,door)<=liveRadiusM;
    },
    draw(camera,yaw,pitch,direct,exterior,roof=false){
      live=false;needed=false;
      if(!door || (!roof && descriptor.doorsEnabled===false)){controller?.idle();return false;}
      const eye=camera.eye,outside=(eye[2]-door.z)*door.side;
      const distance=distanceToDoor(eye,door);
      const near=!roof && distance<=liveRadiusM,retain=!roof && distance<=releaseRadiusM;
      const projection=!exterior && outside<0 && (door.route!=='service'||!hiddenBySideWall(eye,door)) && projectAperture(camera,door);
      if(!projection && !exterior){
        controller?.idle(retain);
        return false;
      }
      needed=true;
      if(error)return false;
      if(!provider){fetchProvider();return false;}
      try{
        controller??=createBridgeBiome(gl,{createProvider:provider});
        const drawn=controller.draw({camera,aperture:door,projection,near,exterior,retain,direct,windTime:readWind,sharedExteriorDepth:!roof,
          scene:()=>({...descriptor.sceneFor(eye,yaw,pitch),direct})});
        live=drawn && near;
        return drawn;
      }catch(reason){
        release();error=String(reason.message||reason);
        console.warn('Meadow doorway unavailable',reason);
        return false;
      }
    },
    dispose(){dead=true;release();descriptor=null;door=null;doors=[];}
  };
}
