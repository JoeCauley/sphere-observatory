import {toMeadow} from './surface-route.js';
import {rampAt} from './border-profile.js';
import {terrain} from '../infinite-meadow/1.3.0/landscape.js';

export function apronHeight(chart,datum,eastM,northM){
  const ramp=rampAt(eastM,northM);
  if(northM>=-18)return ramp;
  const p=toMeadow({eastM,northM,altitudeM:0,yaw:0},chart,0);
  const t=Math.max(0,Math.min(1,(-18-northM)/142));
  return Math.max((terrain(p.eastM,p.northM)-datum)*t*t*(3-2*t),ramp||-Infinity);
}
export function borderUniforms(chart,p){return [p.eastM,p.northM,Math.sin(chart.angle),Math.cos(chart.angle)];}
