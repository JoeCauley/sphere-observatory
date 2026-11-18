import {DATUM_M} from './facility.js';
import {locate} from './pod.js';

export function roofAbove(facility,plantAt,east,north,height) {
  const [x,z]=facility.toLocal(east,north);
  if(Math.abs(x)<19.6 && Math.abs(z+6)<29.1 && height<DATUM_M+22)return true;
  const hex=locate(east,north).hex;
  if(!hex || hex.waterWorks)return false;
  const roof=plantAt(hex).cover(...hex.toLocal(east,north));
  return Number.isFinite(roof) && height-DATUM_M<roof;
}

// null means already clear, false means remain at the controls.
export function escapeFromCover(pose,covered,blocked) {
  const {eastM,northM,altitudeM}=pose;
  if(!covered(eastM,northM,altitudeM))return null;
  for(let radius=4;radius<=96;radius+=4)for(let i=0;i<16;i++){
    const dx=Math.sin(i*Math.PI/8),dz=-Math.cos(i*Math.PI/8);
    const e=eastM+radius*dx,n=northM+radius*dz;
    if(covered(e,n,altitudeM))continue;
    let clear=true;
    for(let d=.5;d<=radius;d+=.5)if(blocked(eastM+d*dx,northM+d*dz,altitudeM)){clear=false;break;}
    if(clear)return {eastM:e,northM:n};
  }
  return false;
}
