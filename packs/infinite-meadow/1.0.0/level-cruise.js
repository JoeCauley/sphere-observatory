import {R,clamp,smooth} from './coordinates.js';

// The unchanged landscape is a convex blend of two fields. The familiar field
// is at most 27 m. The varied field is at most 12 + 1.58*(8+4+3) + 3.5 m.
// Terrain-grid morphs and triangles also use convex interpolation. This is an
// analytic ceiling, not a sampled local maximum. Grass does not affect it.
export const TERRAIN_UPPER_BOUND_M=12+(.72+.86)*(8+4+3)+3.5;
export const LEVEL_GROUND_MARGIN_M=.35;
export const LEVEL_MIN_ALTITUDE_M=TERRAIN_UPPER_BOUND_M+LEVEL_GROUND_MARGIN_M;
export const LEVEL_ENTRY_SECONDS=2.5;

export function stopLevelCruise(motion){
  if(!motion.level)return false;
  motion.level=null;motion.cruise=false;motion.speedMps=0;return true;
}
export function startLevelCruise(state,motion){
  const p=state.pose,altitudeM=Math.max(LEVEL_MIN_ALTITUDE_M,p.altitudeM);
  state.skimEnabled=false;p.mode='flight';motion.cruise=false;motion.speedMps=0;
  motion.level={headingRad:p.yaw,altitudeM,fromAltitudeM:p.altitudeM,
    originEastM:p.eastM,originNorthM:p.northM,distanceM:0,
    elapsedS:0,entrySeconds:altitudeM>p.altitudeM?LEVEL_ENTRY_SECONDS:0};
  return motion.level;
}
export function stepLevelCruise(state,motion,keys,dt){
  if(!motion.level)throw Error('Level cruise is not active');
  if(!Number.isFinite(dt)||dt<0)throw Error('Invalid level-cruise time step');
  const p=state.pose,l=motion.level;
  if(l.elapsedS<l.entrySeconds){
    const consumed=Math.min(dt,l.entrySeconds-l.elapsedS);
    l.elapsedS+=consumed;dt-=consumed;
    p.altitudeM=l.elapsedS===l.entrySeconds?l.altitudeM:
      l.fromAltitudeM+(l.altitudeM-l.fromAltitudeM)*smooth(l.elapsedS/l.entrySeconds);
    motion.speedMps=0;
    if(dt<1e-12||l.elapsedS<l.entrySeconds)return {phase:l.elapsedS===l.entrySeconds?'level':'climbing',speedMps:0,colliding:false,landed:false};
  }
  const boost=keys.has('ShiftLeft')||keys.has('ShiftRight'),target=state.skimSpeedMps*(boost?1.5:1);
  // Integrate the exponential acceleration exactly: frame rate changes do not
  // alter the route or the distance travelled over the same elapsed time.
  const old=motion.speedMps,decay=Math.exp(-dt*2.5);
  const distance=Math.max(0,target*dt+(old-target)*(-Math.expm1(-dt*2.5))/2.5);
  motion.speedMps=target+(old-target)*decay;
  const vx=Math.sin(l.headingRad),vz=-Math.cos(l.headingRad);
  const limits=[vx>0?(Math.PI*R-l.originEastM)/vx:vx<0?(-Math.PI*R-l.originEastM)/vx:Infinity,
    vz>0?(Math.PI*.5*R-l.originNorthM)/vz:vz<0?(-Math.PI*.5*R-l.originNorthM)/vz:Infinity];
  const travel=Math.min(distance,Math.max(0,Math.min(...limits)-l.distanceM));
  l.distanceM+=travel;
  // Calculate from the original line instead of accumulating lateral rounding
  // error independently in both world coordinates during a long cruise.
  p.eastM=clamp(l.originEastM+vx*l.distanceM,-Math.PI*R,Math.PI*R);
  p.northM=clamp(l.originNorthM+vz*l.distanceM,-Math.PI*.5*R,Math.PI*.5*R);
  p.altitudeM=l.altitudeM;
  if(travel<distance){stopLevelCruise(motion);return {phase:'envelope-limit',speedMps:0,colliding:false,landed:false};}
  return {phase:'level',speedMps:motion.speedMps,colliding:false,landed:false};
}
