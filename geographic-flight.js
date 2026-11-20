// A pack chart is an azimuthal equidistant map in metres. The same map is
// used for a hand-flown approach, departure, and the Meadow's northern gate.
import {project,unproject,chartFor,toBorder,toMeadow} from './packs/kit/surface-route.js';
import {terrain} from './packs/infinite-meadow/1.3.0/landscape.js';
const meadowDatum=terrain(0,0);
function gateDatum(gate){return terrain(gate.eastM,gate.northM)-meadowDatum;}
export const enterKm=20, leaveKm=24;
const length=v=>Math.hypot(...v),dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0);
const norm=v=>{const d=length(v);return v.map(x=>x/d);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=x=>Math.max(-1,Math.min(1,x));
const cameraSign=id=>id==='sideways-city'?1:-1;
function chartPoint(chart,q,state,world){
  const {lat,lon}=world.coordinates(q,state);
  return project(chart,lat,lon,state.radius*1000);
}
export function footprint(state,library,atlas,world){
  if(!state.collection||state.layoutVersion!==2||state.shadeAttachment!=null||!library.matchesWorld(state))return null;
  const q=norm(state.position),{lat,lon}=world.coordinates(q,state),plot=atlas.plotAt(lat,lon);
  if(!plot || globalThis.SphereMath?.inBreach(q,state) || (world.woundMetric?.(q,state)?.metric??Infinity)<1)return null;
  const items=library.installed();
  for(const item of items){
    if(!item.edge)continue;
    const home=atlas.byId(item.edge.near),gate=chartFor(home,item.edge,state.radius);
    if(!gate || Math.abs(lat-item.edge.latitude)*state.radius>30)continue;
    const p=chartPoint(home,q,state,world),local=toBorder({...p,altitudeM:100,yaw:0},gate,0);
    if(Math.abs(local.eastM)<Math.min(19999000,gate.halfWidthM) && local.northM>=-2800 && local.northM<=2800)return item;
  }
  const item=items.find(i=>i.plot===plot.index);
  if(!item)return null;
  const c=Math.max(.05,Math.cos(lat)),dl=Math.atan2(Math.sin(lon-plot.longitude),Math.cos(lon-plot.longitude));
  const edge=Math.min(plot.halfHeight-Math.abs(lat-plot.latitude),(Math.PI/plot.columns-Math.abs(dl))*c);
  const step=2*Math.PI/atlas.TRUNK_MERIDIANS, trunk=Math.min(Math.abs(Math.abs(lat)-3*atlas.ROW),Math.abs(lon-Math.round(lon/step)*step)*c);
  return edge*state.radius>atlas.BORDER_KM && trunk*state.radius>atlas.TRUNK_KM?item:null;
}
export function packPose(state,item,atlas,world){
  const id=item.id,chart=atlas.byId(item.edge?.near??item.plotId),q=norm(state.position);
  const p=chartPoint(chart,q,state,world),f=state.forward,vertical=-dot(f,q);
  // Near a vertical sightline the camera's up vector retains its azimuth.
  const horizontal=Math.abs(vertical)>.999999?state.up.map(v=>v*(vertical>0?-1:1)):f;
  const along=norm(q.map((n,i)=>n+1e-7*(horizontal[i]-q[i]*dot(horizontal,q))));
  const ahead=chartPoint(chart,along,state,world);
  const pose={...p,altitudeM:Math.max(1.7,(state.radius-length(state.position))*1000),
    yaw:Math.atan2(ahead.eastM-p.eastM,cameraSign(id)*(ahead.northM-p.northM)),
    pitch:Math.max(-1.5,Math.min(1.5,Math.asin(clamp(vertical)))),mode:state.walkMode?'walk':'flight'};
  if(!item.edge)return pose;
  const gate=chartFor(chart,item.edge,state.radius);
  return toBorder(pose,gate,gateDatum(gate));
}
export function mainPose(state,item,pose,atlas,world){
  const chart=atlas.byId(item.edge?.near??item.plotId),radius=state.radius*1000;
  const gate=item.edge?chartFor(chart,item.edge,state.radius):null;
  const p=gate?toMeadow(pose,gate,gateDatum(gate)):pose;
  const at=(e,n)=>{const g=unproject(chart,e,n,radius);return world.direction(g.latitude,g.longitude,state);};
  const q=at(p.eastM,p.northM),ahead=at(p.eastM+50*Math.sin(p.yaw),p.northM+50*cameraSign(item.id)*Math.cos(p.yaw));
  const tangent=norm(ahead.map((n,i)=>n-dot(ahead,q)*q[i])),c=Math.cos(p.pitch),s=Math.sin(p.pitch);
  const forward=norm(q.map((n,i)=>tangent[i]*c-n*s)),right=norm(cross(forward,q.map(n=>-n)));
  return {...state,position:q.map(n=>n*(state.radius-p.altitudeM/1000)),forward,up:norm(cross(right,forward)),
    walkMode:false,walkSurface:false,walkPosition:null,walkVelocity:0,siteId:'',siteAnchor:null,terrainAnchor:null,shadeAttachment:null};
}
