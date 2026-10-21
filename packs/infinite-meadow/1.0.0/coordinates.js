import './vendor/world-address.js';
export const R = 149597870700;
export const STAR = 695700000;
export const CELL = 256;
export const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
export const mix = (a,b,t)=>a+(b-a)*t;
export const smooth = t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm=a=>{const d=Math.hypot(...a);if(!d)throw Error('Undefined direction');return a.map(x=>x/d);};
export function frame(lat,lon){
  const radial=[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];
  const east=[-Math.sin(lon),Math.cos(lon),0],up=radial.map(x=>-x),north=cross(east,up);
  return {radial,east,up,north,lat,lon};
}
export function poseFrame(p){return frame(p.northM/R,p.eastM/R);}
export function toGlobal(p){return poseFrame(p).radial.map(v=>v*(R-p.altitudeM));}
export function fromGlobal(g,{poleLongitude=0}={}){
  if(!Array.isArray(g)||g.length!==3||!g.every(Number.isFinite))throw Error('Invalid global vector');
  const radius=Math.hypot(...g);if(radius===0)throw Error('Centre needs an explicit nonradial frame');
  const lon=Math.hypot(g[0],g[1])<1e-9?poleLongitude:Math.atan2(g[1],g[0]);
  return {eastM:lon*R,northM:Math.atan2(g[2],Math.hypot(g[0],g[1]))*R,altitudeM:R-radius};
}
export function address(p){
  const axis=v=>{const cell=Math.trunc(v/CELL)||0;return {cell,localM:v-cell*CELL};};
  return {schema:1,worldRevision:'scale-study-v03',siteId:'rolling-meadow-study-03',east:axis(p.eastM),north:axis(p.northM),altitudeM:p.altitudeM};
}
export function fromAddress(a){
  if(a?.schema!==1||a.worldRevision!=='scale-study-v03'||a.siteId!=='rolling-meadow-study-03')throw Error('Unsupported study address');
  for(const v of [a.east,a.north])if(!Number.isSafeInteger(v?.cell)||!Number.isFinite(v.localM)||Math.abs(v.localM)>=CELL||(v.cell!==0&&v.localM!==0&&Math.sign(v.cell)!==Math.sign(v.localM)))throw Error('Invalid signed cell/local offset');
  if(!Number.isFinite(a.altitudeM))throw Error('Invalid altitude');
  return {eastM:a.east.cell*CELL+a.east.localM,northM:a.north.cell*CELL+a.north.localM,altitudeM:a.altitudeM};
}
export function canonicalShell(p){return globalThis.SphereWorldAddress.shell({worldSeed:713,geographyRevision:1,terrainRevision:3,artRevision:3,assetRevision:3,direction:poseFrame(p).radial,level:30});}
export function renderOrigin(p,forced){
  return forced??{eastM:Math.floor(p.eastM/CELL)*CELL,northM:Math.floor(p.northM/CELL)*CELL,altitudeM:Math.floor(p.altitudeM/CELL)*CELL};
}
export function relative(a,b){
  // Global subtraction is adequate for far objects. Local region geometry keeps
  // metre offsets authoritative rather than subtracting two AU-size values.
  if(Math.abs(a.eastM-b.eastM)+Math.abs(a.northM-b.northM)<100000){
    const da=(a.northM-b.northM)/R,dl=(a.eastM-b.eastM)/R,lat=b.northM/R,r=R-a.altitudeM;
    const sinHalf=x=>2*Math.sin(x/2)**2;
    const radialDelta=-sinHalf(da)-Math.cos(lat)*Math.cos(lat+da)*sinHalf(dl);
    return [r*Math.cos(lat+da)*Math.sin(dl),a.altitudeM-b.altitudeM-r*radialDelta,r*(Math.sin(da)+Math.sin(lat)*Math.cos(lat+da)*sinHalf(dl))];
  }
  const ag=toGlobal(a),bg=toGlobal(b),d=ag.map((v,i)=>v-bg[i]),f=poseFrame(b);
  return [dot(d,f.east),dot(d,f.up),dot(d,f.north)];
}
export function cameraBasis(p){
  const c=Math.cos(p.pitch),s=Math.sin(p.pitch),y=p.yaw;
  const forward=[Math.sin(y)*c,s,-Math.cos(y)*c],right=[Math.cos(y),0,Math.sin(y)],up=cross(right,forward);
  return {forward,right,up};
}
export function innerHit(altitude,rayY){
  const a=altitude/R,m=(1-a)*rayY,s=Math.sqrt(m*m+a*(2-a));
  return m<0?altitude*(2-a)/(s-m):R*(s+m);
}
export function hash32(str){let h=2166136261;for(let i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),16777619);return h>>>0;}
export const unitHash=str=>hash32(str)/4294967296;

