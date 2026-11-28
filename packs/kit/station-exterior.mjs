import {project,unproject} from './surface-route.js';
import {mainPose,packPose,stationBasis} from '../../geographic-flight.js';
import {borderAt,districtLocation,districtPoint,nearestSite,outsideDistrict,hallHalfM,apronRunM,apronHalfWidthsM} from '../border-transport/0.10.0/district.mjs';

// Map small camera-relative offsets into the station chart before converting to GPU floats.
export function frontageFrame(chart,pose,district,station){
  const radius=district.origin.radiusM;
  const point=(east,north)=>{
    const ll=unproject(chart,east,north,radius);
    return districtPoint(district,ll.latitude,ll.longitude);
  };
  const p=point(pose.eastM,pose.northM),e=point(pose.eastM+128,pose.northM),n=point(pose.eastM,pose.northM+128);
  return {eastM:pose.eastM,northM:pose.northM,
    bounds:[p.eastM-station.address.chainageM,p.northM,hallHalfM,station.widthM/2],
    axes:[(e.eastM-p.eastM)/128,(n.eastM-p.eastM)/128,(e.northM-p.northM)/128,(n.northM-p.northM)/128],
    doors:station.routes.map(route=>route.nearDoor[0]),clearances:apronHalfWidthsM,apronRunM};
}

// A lot that intersects a wall or door approach can be kept as open ground by any pack.
export function occupiedLot(field,eastM,northM,halfM){
  if(!field)return false;
  const [a,b,c,d]=field.axes,[x,z,halfX,halfZ]=field.bounds;
  const dx=eastM-field.eastM,dz=northM-field.northM;
  const along=x+a*dx+b*dz,across=Math.abs(z+c*dx+d*dz);
  const padX=halfM*(Math.abs(a)+Math.abs(b)),padZ=halfM*(Math.abs(c)+Math.abs(d));
  if(Math.abs(along)<=halfX+padX && across<=halfZ+padZ)return true;
  return across<=halfZ+field.apronRunM+padZ && field.doors.some((door,i)=>Math.abs(along-door)<=field.clearances[i]+padX);
}

export function packStationExterior(host,canvas,item,{logDepthFarM=0}={}){
  const library=host.SphereBiomeLibrary,stage=host.SphereStageFrame,world=host.SphereWorld,atlas=host.SphereAtlas;
  const chart=item.occurrence??atlas.byId(item.plotId);
  let primary=library.entry('border-transport'),border=null,station=null,view=null,constrain=null,field=null;
  let wanted=null,loading=null,error=null,serial=0,poseKey=null,local=null,camera=null;
  let programLifetime=null;
  function release(){
    programLifetime?.abort();programLifetime=null;
    serial++;view?.dispose();view=null;station=null;loading=null;wanted=null;field=null;poseKey=null;camera=null;error=null;
  }
  const changed=()=>{primary=library.entry('border-transport');release();};
  host.addEventListener('sphere-biomes-changed',changed);
  function point(p){
    const coord=unproject(chart,p.eastM,p.northM,primary.transport.origin.radiusM);
    return {coord,border:borderAt(primary,coord.latitude,coord.longitude)};
  }
  function sync(p){
    if(!primary || !chart)return null;
    if(poseKey?.[0]===p.eastM && poseKey[1]===p.northM && poseKey[2]===p.altitudeM)return field;
    const cell=point(p),d=cell.border.transport;
    local=districtPoint(d,cell.coord.latitude,cell.coord.longitude);
    const site=nearestSite(d,local.eastM),range=Math.hypot(Math.max(0,outsideDistrict(d,local.eastM,local.northM)),p.altitudeM);
    if(range>160000){if(wanted)release();return null;}
    if(wanted!==site.address.key){
      release();border=cell.border;wanted=site.address.key;const token=serial;
      loading=stage.stationExterior(site.address,library.persistence==='file').then(async result=>{
        if(token!==serial)return;
        programLifetime = new AbortController();
        const preparedProgram = await result.prepareExteriorProgram?.(canvas, logDepthFarM, programLifetime.signal);
        if(token!==serial){
          if(preparedProgram)canvas.getContext('webgl2').deleteProgram(preparedProgram);
          return;
        }
        station=result.station;constrain=result.constrainExterior;
        view=result.makeView(canvas,{shared:true,preparedProgram,logDepthFarM,district:d,habitats:s=>stage.stationHabitats(d,s)});
        view.load(station);poseKey=null;
      }).catch(e=>{if(token===serial)error=e;}).finally(()=>{if(token===serial)loading=null;});
    }
    poseKey=[p.eastM,p.northM,p.altitudeM];
    field=station && Math.abs(local.eastM-site.x)<=hallHalfM+12000 && Math.abs(local.northM)<=site.widthM/2+apronRunM+12000
      ?frontageFrame(chart,p,d,station):null;
    return field;
  }
  return {
    sync,get pending(){return loading;},get error(){return error;},get field(){return field;},
    occupies(eastM,northM,halfM){return occupiedLot(field,eastM,northM,halfM);},
    get station(){return station?.address.key??null;},
    constrain(from,to){
      if(!station||!view||from.eastM===to.eastM&&from.northM===to.northM&&from.altitudeM===to.altitudeM)return to;
      const d=border.transport,map=p=>{const pos=unproject(chart,p.eastM,p.northM,d.origin.radiusM);return {...p,...districtPoint(d,pos.latitude,pos.longitude)};};
      const next=map(to),safe=constrain(station,d,map(from),next);
      if(safe===next)return to;
      const ll=districtLocation(d,safe.eastM,safe.northM);
      return {...to,...project(chart,ll.latitude,ll.longitude,d.origin.radiusM),altitudeM:safe.altitudeM};
    },
    draw(pose,w,h,focal){
      if(!view||!station)return;
      if(!camera||['eastM','northM','altitudeM','yaw','pitch'].some(k=>camera.pose[k]!==pose[k])){
        const state=mainPose(host.SphereApp.getState(),item,pose,atlas,world);
        const p=packPose(state,border,atlas,world,{exactAltitude:true});
        camera={pose:{...pose},local:p,axes:stationBasis(state,border.transport,p,world)};
      }
      const {local:p,axes}=camera;
      view.draw(station,[p.eastM-station.address.chainageM,p.altitudeM,p.northM+station.widthM/2],p.yaw,p.pitch,
        host.SphereApp.sceneSeconds,false,host.SphereStageFrame.surfaceLight(canvas.ownerDocument.defaultView,pose)?.direct??1,
        {...axes,width:w,height:h,near:.1,focal});
    },
    dispose(){host.removeEventListener('sphere-biomes-changed',changed);release();}
  };
}
