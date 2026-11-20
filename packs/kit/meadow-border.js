import {toMeadow} from './surface-route.js';
import {terrain} from '../infinite-meadow/1.3.0/landscape.js';

export function apronHeight(chart,datum,eastM,northM){
  if(northM>=-18)return 0;
  const p=toMeadow({eastM,northM,altitudeM:0,yaw:0},chart,0);
  const t=Math.max(0,Math.min(1,(-18-northM)/142));
  return (terrain(p.eastM,p.northM)-datum)*t*t*(3-2*t);
}
export function borderUniforms(chart,p){return [p.eastM,p.northM,Math.sin(chart.angle),Math.cos(chart.angle)];}
