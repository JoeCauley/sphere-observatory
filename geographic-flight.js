// A pack chart is an azimuthal equidistant map in metres. The same map is
// used for a hand-flown approach, departure, and the Meadow's northern gate.
import {project,unproject,chartFor,toBorder,toMeadow} from './packs/kit/surface-route.js';
import {farEdgeM,onBorder,rampRunM} from './packs/kit/border-profile.js';
import {terrain} from './packs/infinite-meadow/1.3.0/landscape.js';
import {districtPoint,districtLocation,outsideDistrict,hallHalfM,apronRunM} from './packs/border-transport/0.10.0/district.mjs';
export {outsideDistrict,nearestSite,roofSlabM,apronRunM,hallHalfM} from './packs/border-transport/0.10.0/district.mjs';
const meadowDatum=terrain(0,0);
function gateDatum(gate){return terrain(gate.eastM,gate.northM)-meadowDatum;}
export const enterKm=20, leaveKm=24;
export {onBorder};
const length=v=>Math.hypot(...v),dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0);
const norm=v=>{const d=length(v);return v.map(x=>x/d);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=x=>Math.max(-1,Math.min(1,x));
const cameraSign=id=>id==='sideways-city'?1:-1;
function chartPoint(chart,q,state,world){
  const {lat,lon}=world.coordinates(q,state);
  return project(chart,lat,lon,state.radius*1000);
}
// Express each surveyed station in the adjoining chart once. Subtract the chart origin in
// double precision before a metre-scale opening or a shader sees these coordinates.
export function meadowStations(district,home){
  if(!district || !home)return [];
  const r=district.origin.radiusM;
  const at=(x,z)=>{const p=districtLocation(district,x,z);return project(home,p.latitude,p.longitude,r);};
  const locate=(east,north)=>{const p=unproject(home,east,north,r);return districtPoint(district,p.latitude,p.longitude);};
  return district.sites.map(site=>{
    const origin=at(site.x,0),along=at(site.x+1000,0),across=at(site.x,1000);
    const ex=(along.eastM-origin.eastM)/1000,nx=(along.northM-origin.northM)/1000;
    const ez=(across.eastM-origin.eastM)/1000,nz=(across.northM-origin.northM)/1000,det=ex*nz-ez*nx;
    return {site,origin,locate,axes:[nz/det,-ez/det,-nx/det,ex/det],halfX:hallHalfM,halfZ:site.widthM/2+apronRunM};
  });
}
export function footprint(state,library,atlas,world){
  if(!state.collection||state.layoutVersion!==2||state.shadeAttachment!=null||!library.matchesWorld(state))return null;
  const q=norm(state.position),{lat,lon}=world.coordinates(q,state),plot=atlas.plotAt(lat,lon);
  if(!plot || globalThis.SphereMath?.inBreach(q,state) || (world.woundMetric?.(q,state)?.metric??Infinity)<1)return null;
  const items=library.installed();
  for(const item of items){
    if(item.transport){
      const d=item.transport;
      if(Math.abs(lat-d.origin.latitude)*state.radius>220)continue;
      const p=districtPoint(d,lat,lon);
      if(outsideDistrict(d,p.eastM,p.northM)<=(state.walkMode?8:450))return item;
      continue;
    }
    if(!item.edge)continue;
    const home=atlas.byId(item.edge.near),gate=chartFor(home,item.edge,state.radius);
    if(!gate || Math.abs(lat-item.edge.latitude)*state.radius>(farEdgeM+rampRunM)/1000+100)continue;
    const p=chartPoint(home,q,state,world),local=toBorder({...p,altitudeM:100,yaw:0},gate,0);
    if(onBorder(local,gate.halfWidthM))return item;
  }
  return atlas.regionAt(items,lat,lon);
}
// Transform the actual camera basis, including roll, into the survey chart.
export function stationBasis(s,d,p,world){
  const ray=(x,z)=>{const g=districtLocation(d,x,z);return world.direction(g.latitude,g.longitude,s);};
  const q=ray(p.eastM,p.northM),up=q.map(n=>-n);
  function tangent(v){return norm(v.map((n,i)=>n-dot(v,q)*q[i]));}
  const x=tangent(ray(p.eastM+50,p.northM)),z0=tangent(ray(p.eastM,p.northM+50));
  const z=norm(z0.map((n,i)=>n-dot(z0,x)*x[i])),right=norm(cross(s.forward,s.up));
  const axes=v=>[dot(v,x),dot(v,up),dot(v,z)];
  return {right:axes(right),up:axes(norm(cross(right,s.forward))),forward:axes(s.forward)};
}
export function packPose(state,item,atlas,world){
  const id=item.id,chart=atlas.byId(item.edge?.near??item.plotId),q=norm(state.position);
  const point=v=>{if(!item.transport)return chartPoint(chart,v,state,world);
    const c=world.coordinates(v,state);return districtPoint(item.transport,c.lat,c.lon);};
  const p=point(q),f=state.forward,vertical=-dot(f,q);
  // Near a vertical sightline the camera's up vector retains its azimuth.
  const horizontal=Math.abs(vertical)>.999999?state.up.map(v=>v*(vertical>0?-1:1)):f;
  const along=norm(q.map((n,i)=>n+1e-7*(horizontal[i]-q[i]*dot(horizontal,q))));
  const ahead=point(along);
  const pose={...p,altitudeM:Math.max(1.7,(state.radius-length(state.position))*1000),
    yaw:Math.atan2(ahead.eastM-p.eastM,(item.transport?1:cameraSign(id))*(ahead.northM-p.northM)),
    pitch:Math.max(-1.5,Math.min(1.5,Math.asin(clamp(vertical)))),mode:state.walkMode?'walk':'flight'};
  if(!item.edge || item.transport)return pose;
  const gate=chartFor(chart,item.edge,state.radius);
  return toBorder(pose,gate,gateDatum(gate));
}
// The pack chart is a map of a particular place in this world. Lighting and
// navigation project the same local receiver onto the inner shell.
export function worldPosition(state,item,pose,atlas,world){
  const chart=atlas.byId(item.edge?.near??item.plotId);
  const gate=item.edge&&!item.transport?chartFor(chart,item.edge,state.radius):null;
  const p=gate?toMeadow(pose,gate,gateDatum(gate)):pose;
  const at=item.transport?districtLocation(item.transport,p.eastM,p.northM):unproject(chart,p.eastM,p.northM,state.radius*1000);
  return world.direction(at.latitude,at.longitude,state).map(v=>v*(state.radius-p.altitudeM/1000));
}
// Local floors can sit below the nominal geoid. From a surveyed interior
// position the nominal shell must not shadow its own receiver.
export function lightReceiver(state,item,pose,atlas,world){
  const p=worldPosition(state,item,pose,atlas,world),r=length(p),inner=state.radius-.0001;
  return r>inner?p.map(v=>v*inner/r):p;
}
export function mainPose(state,item,pose,atlas,world){
  const chart=atlas.byId(item.edge?.near??item.plotId),radius=state.radius*1000;
  const gate=item.edge&&!item.transport?chartFor(chart,item.edge,state.radius):null;
  const p=gate?toMeadow(pose,gate,gateDatum(gate)):pose;
  const at=(e,n)=>{const g=item.transport?districtLocation(item.transport,e,n):unproject(chart,e,n,radius);return world.direction(g.latitude,g.longitude,state);};
  const q=at(p.eastM,p.northM),ahead=at(p.eastM+50*Math.sin(p.yaw),p.northM+50*(item.transport?1:cameraSign(item.id))*Math.cos(p.yaw));
  const tangent=norm(ahead.map((n,i)=>n-dot(ahead,q)*q[i])),c=Math.cos(p.pitch),s=Math.sin(p.pitch);
  const forward=norm(q.map((n,i)=>tangent[i]*c-n*s)),right=norm(cross(forward,q.map(n=>-n)));
  return {...state,position:q.map(n=>n*(state.radius-p.altitudeM/1000)),forward,up:norm(cross(right,forward)),
    walkMode:false,walkSurface:false,walkPosition:null,walkVelocity:0,siteId:'',siteAnchor:null,terrainAnchor:null,shadeAttachment:null};
}
