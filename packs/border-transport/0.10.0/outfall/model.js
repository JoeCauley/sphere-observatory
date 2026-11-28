import {channelLevels} from '../maintenance.mjs';
export const valve={eastM:1.30,northM:12.0,heightM:1.48};
export const eye=1.7;
export const entrance=()=>({eastM:-2.2,northM:-18,altitudeM:eye,yaw:.11,pitch:.025,mode:'walk'});
export const initial=()=>({pose:entrance(),bookmark:entrance(),open:true,levels:[1,1,1]});
export const validPose=p=>p&&['eastM','northM','altitudeM','yaw','pitch'].every(k=>Number.isFinite(p[k]))&&
  Math.abs(p.eastM)<2e7&&Math.abs(p.northM)<2e7&&p.altitudeM>=(p.northM<0?-60:0)&&p.altitudeM<=2e6&&Math.abs(p.pitch)<=1.56&&['walk','flight'].includes(p.mode);
export function restore(raw){
  if(raw?.schema!==1||!validPose(raw.pose)||!validPose(raw.bookmark)||typeof raw.open!=='boolean'||
    !Array.isArray(raw.levels)||raw.levels.length!==3||!raw.levels.every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('Invalid Outfall save');
  return {pose:{...raw.pose},bookmark:{...raw.bookmark},open:raw.open,levels:[...raw.levels]};
}
export function nearValve(p){return p.mode==='walk'&&Math.abs(p.altitudeM-valve.heightM)<2&&Math.hypot(p.eastM-valve.eastM,p.northM-valve.northM)<2.7;}
export function waterStep(state,dt){
  state.levels=channelLevels(state.open,state.levels,dt);
}
