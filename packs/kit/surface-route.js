import {onBorder,halfLengthM} from './border-profile.js';
// The Meadow's local map preserves great-circle distance and bearing from its
// arrival point. Work in double precision until positions are local to the gate.
export function project(home, latitude, longitude, radiusM) {
  const d = longitude - home.longitude;
  const e = Math.cos(latitude) * Math.sin(d);
  const n = Math.cos(home.latitude) * Math.sin(latitude) -
    Math.sin(home.latitude) * Math.cos(latitude) * Math.cos(d);
  const dot = Math.sin(home.latitude) * Math.sin(latitude) +
    Math.cos(home.latitude) * Math.cos(latitude) * Math.cos(d);
  const horizontal = Math.hypot(e, n);
  const scale = horizontal ? radiusM * Math.atan2(horizontal, dot) / horizontal : 0;
  return {eastM:e * scale, northM:n * scale};
}
export function unproject(home,eastM,northM,radiusM){
  const distance=Math.hypot(eastM,northM);
  if(!distance)return {latitude:home.latitude,longitude:home.longitude};
  const angle=distance/radiusM,c=Math.cos(angle),s=Math.sin(angle),n=northM/distance,e=eastM/distance;
  const lat=home.latitude,latitude=Math.asin(Math.max(-1,Math.min(1,c*Math.sin(lat)+n*s*Math.cos(lat))));
  const lon=home.longitude+Math.atan2(e*s,c*Math.cos(lat)-n*s*Math.sin(lat));
  return {latitude,longitude:Math.atan2(Math.sin(lon),Math.cos(lon))};
}
export function chartFor(home, edge, radiusKm) {
  if (!home || !edge || edge.near !== home.id || !(radiusKm > 0)) return null;
  const radiusM = radiusKm * 1000, gate = project(home, edge.latitude, edge.longitude, radiusM);
  const left = project(home, edge.latitude, edge.longitude - 1e-6, radiusM);
  const right = project(home, edge.latitude, edge.longitude + 1e-6, radiusM);
  const angle = Math.atan2(right.northM - left.northM, right.eastM - left.eastM);
  return {...gate, angle, edge:edge.id, halfWidthM:radiusM * home.halfWidth};
}
export function course(p, chart) {
  const east = chart.eastM - p.eastM, north = chart.northM - p.northM;
  return {distanceM:Math.hypot(east, north), heading:Math.atan2(east, -north)};
}
export function toBorder(p, chart, datum) {
  const e = p.eastM - chart.eastM, n = p.northM - chart.northM;
  const c = Math.cos(chart.angle), s = Math.sin(chart.angle);
  return {...p, eastM:-(e*c + n*s), northM:-e*s + n*c, altitudeM:p.altitudeM-datum,
    yaw:p.yaw - chart.angle - Math.PI};
}
export function toMeadow(p, chart, datum) {
  const c = Math.cos(chart.angle), s = Math.sin(chart.angle);
  return {...p, eastM:chart.eastM-p.eastM*c-p.northM*s, northM:chart.northM-p.eastM*s+p.northM*c,
    altitudeM:p.altitudeM+datum, yaw:p.yaw+chart.angle+Math.PI};
}
// The two views overlap on the exterior apron. Distinct gates prevent a
// stationary or freshly restored traveler from bouncing between renderers.
export const enterNorthM = -2400, leaveNorthM = -2800;
export function inApproach(p, chart) {
  return Math.abs(p.eastM) < Math.min(chart.halfWidthM,halfLengthM) && p.altitudeM<20000;
}
export function reachesBorder(p,chart){
  return inApproach(p,chart) && onBorder(p,chart.halfWidthM);
}
