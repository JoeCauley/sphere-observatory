import {createBridgeBiome,projectAperture} from '../../kit/bridge-biome.mjs';
import {hallHalfM,apronRunM,apronTopM} from './district.mjs';

// From the apron the near facade can hide the entire far window. Intersect
// the four sightlines with that facade before requesting an exterior picture.
function behindNearWall(eye,far,wallZ,roof,openings){
  const t=(wallZ-eye[2])/(far.z-eye[2]);
  if(!(t>0&&t<1))return false;
  const loX=eye[0]+t*(far.xMin-eye[0]),hiX=eye[0]+t*(far.xMax-eye[0]);
  const loY=eye[1]+t*(far.yMin-eye[1]),hiY=eye[1]+t*(far.yMax-eye[1]);
  if(loX<-hallHalfM||hiX>hallHalfM||loY<0||hiY>roof)return false;
  return !openings.some(door=>loX<door.xMax&&hiX>door.xMin&&loY<door.yMax&&hiY>door.yMin);
}

// Across a station even the monumental opening is a small picture. All four
// photographs can share one Meadow renderer, and wind cannot invalidate them.
export function makeMeadowDoorPictures(gl,resolve,invalidate){
  let destination=null,openings=[],createProvider=null,loading=null,failed=false,dead=false;
  let provider=null;
  let nearFacadeZ=0,roof=0;
  const cards=new Map();
  function release(){
    for(const card of cards.values())card.dispose();
    cards.clear();
    provider?.dispose();provider=null;
  }
  function request(){
    if(loading||failed)return;
    loading=import('../../kit/meadow-bridge.mjs').then(module=>{createProvider=module.createMeadowBridge;})
      .catch(error=>{failed=true;console.warn('Distant Meadow view unavailable',error);})
      .finally(()=>{loading=null;if(!dead)invalidate?.();});
  }
  const sharedProvider={draw(args){return provider.draw(args);},dispose(){}};
  return {
    load(station,enabled=true){
      const next=enabled?resolve(station):null;
      if(next===destination)return;
      release();destination=next;failed=false;
      roof=station.roofM;nearFacadeZ=next?.side<0?station.widthM:0;
      openings=next?station.routes.map(route=>{
        const [x,y,z]=next.side<0?route.nearDoor:route.farDoor;
        return {key:station.address.key+'/'+route.id,route:route.id,xMin:x-route.door[0]/2,xMax:x+route.door[0]/2,
          yMin:y,yMax:y+route.door[1],z,side:next.side,roadEndZ:z+next.side*apronRunM,roadTopY:apronTopM};
      }):[];
    },
    draw(camera,yaw,pitch,direct,framebuffer,liveRoute){
      if(!destination||failed)return;
      try{
        for(const aperture of openings){
          const depth=destination.side*(aperture.z-camera.eye[2]);
          const visible=depth>0 && camera.eye[1]<roof && aperture.route!==liveRoute
            && !behindNearWall(camera.eye,aperture,nearFacadeZ,roof,openings) && projectAperture(camera,aperture);
          let card=cards.get(aperture.key);
          if(!visible){
            if(card){card.dispose();cards.delete(aperture.key);}
            continue;
          }
          if(!createProvider){request();continue;}
          provider??=createProvider(gl,{clipAtAperture:true});
          if(!card){
            card=createBridgeBiome(gl,{createProvider:()=>sharedProvider,depthTestPicture:true});
            cards.set(aperture.key,card);
          }
          card.draw({camera,aperture,projection:visible,near:false,framebuffer,direct,scene:()=>{
            const scene=destination.sceneFor(camera.eye,yaw,pitch);
            // Main may roll its camera. Transform all three sightline axes into
            // the same Meadow tangent chart used to plant the landscape.
            const [a,b,c,d]=scene.apron.row.axes,det=a*d-b*c;
            const axis=([x,y,z])=>{
              const east=(d*x-b*z)/det,north=(a*z-c*x)/det,k=Math.hypot(east,y,north);
              return [east/k,y/k,north/k];
            };
            return {...scene,basis:{right:axis(camera.right),up:axis(camera.up),forward:axis(camera.forward)}};
          }});
        }
        if(!cards.size && provider){provider.dispose();provider=null;}
      }catch(error){release();failed=true;console.warn('Distant Meadow capture failed',error);}
    },
    get preparation(){return loading;},
    get stats(){
      return {pending:!!loading,failed,pictures:[...cards.values()].map(card=>{
        const {activeKey,width,height,captureCount,reuseCount,residentBytes}=card.stats;
        return {activeKey,width,height,captureCount,reuseCount,residentBytes};
      })};
    },
    dispose(){dead=true;release();}
  };
}
