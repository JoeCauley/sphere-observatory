import {nearbyEdges,edgeCoordinates,pointOnEdge,meetsMeridian,addressAt} from './edges.mjs';
import {districtLocation,installedEdge,sitesInRange,frontageLimit,hallHalfM,linkHalfM,roofSlabM} from './district.mjs';

import {freightFloorTint} from '../../kit/freight-floor.mjs';

const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const combine=(a,b,x,y)=>a.map((n,i)=>n*x+b[i]*y);

function tangentOffsets(origin,point){
  const dl=point.longitude-origin.longitude,dp=point.latitude-origin.latitude;
  const c=Math.cos(point.latitude),half=Math.sin(dl*.5);
  return [c*Math.sin(dl),Math.sin(dp)+2*Math.sin(origin.latitude)*c*half*half];
}

// Chart coordinates are addresses. Only physical metres in an orthonormal shell
// tangent frame may be sent to the perspective camera, particularly near the antipode.
function wallFrame(d,x,z){
  const center=districtLocation(d,x,z),lat=center.latitude,lon=center.longitude;
  const east=[-Math.sin(lon),Math.cos(lon),0],north=[-Math.sin(lat)*Math.cos(lon),-Math.sin(lat)*Math.sin(lon),Math.cos(lat)];
  const up=[-Math.cos(lat)*Math.cos(lon),-Math.cos(lat)*Math.sin(lon),-Math.sin(lat)];
  const [e,n]=tangentOffsets(center,districtLocation(d,x+1000,z)),len=Math.hypot(e,n);
  const along=len?[e/len,n/len]:[0,1],across=tangentOffsets(center,districtLocation(d,x,z+1000));
  const sign=along[0]*across[1]-along[1]*across[0]<0?-1:1;
  const side=[-sign*along[1],sign*along[0]];
  return {center,along,side,axes:[combine(east,north,...along),up,combine(east,north,...side)]};
}
function localMetres(frame,point,r,h=0){
  const [e,n]=tangentOffsets(frame.center,point),a=Math.sin((point.latitude-frame.center.latitude)*.5),b=Math.sin((point.longitude-frame.center.longitude)*.5);
  const sag=2*(a*a+Math.cos(point.latitude)*Math.cos(frame.center.latitude)*b*b);
  return [(r-h)*(e*frame.along[0]+n*frame.along[1]),h+(r-h)*sag,(r-h)*(e*frame.side[0]+n*frame.side[1])];
}
export function wallCamera(d,tile,x,z,h,basis,yaw,chartCamera){
  const here=wallFrame(d,x,z),axes=tile.frame.axes;
  let {right,up,forward}=basis;
  if(chartCamera && Math.hypot(x,z)>d.origin.radiusM*.0001){
    const end=districtLocation(d,x+1000*Math.sin(yaw),z+1000*Math.cos(yaw));
    const [e,n]=tangentOffsets(here.center,end),len=Math.hypot(e,n);
    if(len){
      const sn=(e*here.along[0]+n*here.along[1])/len,cs=(e*here.side[0]+n*here.side[1])/len;
      const sp=forward[1],cp=up[1],hand=d.origin.axis==='meridian'?d.origin.acrossSign:-1;
      right=[hand*cs,0,-hand*sn];up=[-sn*sp,cp,-cs*sp];forward=[sn*cp,sp,cs*cp];
    }
  }
  const rotate=v=>axes.map(axis=>v[0]*dot(axis,here.axes[0])+v[1]*dot(axis,here.axes[1])+v[2]*dot(axis,here.axes[2]));
  return {eye:localMetres(tile.frame,here.center,d.origin.radiusM,h),right:rotate(right),up:rotate(up),forward:rotate(forward)};
}

export const wallTileM=32000,wallReachM=1600000,wallHeightM=1700;
// Local vertices are relative to a stable tile. Surface curvature is positive
// when viewed from the cavity. No vertex contains a planetary-scale float.
export function wallWindow(d,east,north,mesh){
  const r=d.origin.radiusM,reach=Math.min(wallReachM,r*globalThis.SphereAtlas.ROW*.43);
  const tile=Math.min(wallTileM,reach/12);
  const x=Math.round(east/tile)*tile,z=Math.round(north/tile)*tile;
  const frame=wallFrame(d,x,z),center=frame.center,primary=installedEdge(d);
  const edges=nearbyEdges(center.latitude,center.longitude,r,reach+tile*2);
  const roof=wallHeightM+roofSlabM,steel=[.27,.35,.36],sideSteel=[.33,.40,.40],floor=freightFloorTint;
  let segments=0;
  for(const edge of edges){
    const near=edgeCoordinates(edge,center.latitude,center.longitude);
    const end=edge.lengthM/2,parallel=edge.axis==='parallel';
    const lo=Math.max(-end+(parallel?0:linkHalfM),near.alongM-reach);
    const hi=Math.min(end-(parallel?0:linkHalfM),near.alongM+reach);
    if(hi<=lo)continue;
    const minus=parallel?[meetsMeridian(edge,0,-1),meetsMeridian(edge,1,-1)]:[false,false];
    const plus=parallel?[meetsMeridian(edge,0,1),meetsMeridian(edge,1,1)]:[false,false];
    // A cap on the south pole has its occupied parcel on its north face.
    if(edge.plots[1]==='polar-south'){minus.reverse();plus.reverse();}
    const cuts=new Set([lo,hi]);
    const cut=v=>{if(v>lo&&v<hi)cuts.add(v);};
    if(parallel){cut(-end+linkHalfM);cut(end-linkHalfM);}
    const field=d.mineralFrontage?.edge.id===edge.id?d.mineralFrontage:null;
    if(field)for(const sign of [-1,1]){
      cut(field.alongM+sign*field.halfM);
      cut(field.alongM+sign*(field.halfM+2*(linkHalfM-field.innerM)));
    }
    const halls=edge.id===primary.id?sitesInRange(d,lo-hallHalfM,hi+hallHalfM):[];
    for(const s of halls){cut(s.x-hallHalfM);cut(s.x+hallHalfM);}
    // Set the grid in edge chainage, so adjacent resident windows share vertices.
    const pitch=Math.min(32000,Math.sqrt(8*r*.01));
    for(let t=Math.ceil(lo/pitch)*pitch;t<hi;t+=pitch)cut(t);
    const points=[...cuts].sort((a,b)=>a-b);
    function section(along,across){
      const g=pointOnEdge(edge,along,across);
      return localMetres(frame,g,r);
    }
    const lift=(p,h)=>{const k=1-h/r;return [p[0]*k,h+p[1]*k,p[2]*k];};
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],mid=(a+b)/2;
      if(halls.some(s=>Math.abs(mid-s.x)<hallHalfM))continue;
      const limitA=field?frontageLimit(field,a):linkHalfM,limitB=field?frontageLimit(field,b):linkHalfM;
      const l=section(a,field?.side<0?-limitA:-linkHalfM),u=section(b,field?.side<0?-limitB:-linkHalfM);
      const v=section(b,field?.side>0?limitB:linkHalfM),w=section(a,field?.side>0?limitA:linkHalfM);
      const cross=(u[2]-l[2])*(w[0]-l[0])-(u[0]-l[0])*(w[2]-l[2]);
      const face=(p,q,s,t,color)=>cross>0?mesh.quad(p,q,s,t,color):mesh.quad(t,s,q,p,color);
      face(lift(l,roof),lift(u,roof),lift(v,roof),lift(w,roof),steel);
      face(lift(w,wallHeightM),lift(v,wallHeightM),lift(u,wallHeightM),lift(l,wallHeightM),steel);
      face(l,u,v,w,floor);
      for(let side=0;side<2;side++){
        if((minus[side]&&mid< -end+linkHalfM)||(plus[side]&&mid>end-linkHalfM))continue;
        const [f,g]=side?[v,w]:[l,u];
        // The foundation extends below grade. There are no caps at stream boundaries.
        face(lift(g,-40),lift(f,-40),lift(f,roof),lift(g,roof),sideSteel);
      }
      segments++;
    }
  }
  // Material coordinates use the same two geographic directions as the Atlas edge.
  // Keep the large chainage on the CPU. A GPU float otherwise loses entire plates.
  const address=addressAt(center.latitude,center.longitude,r),edge=address.edge;
  const phase=[address.alongM,address.acrossM].map(v=>((v%32000)+32000)%32000);
  const longitude=Math.atan2(Math.sin(center.longitude-edge.longitude),Math.cos(center.longitude-edge.longitude));
  const toEdge=([e,n])=>edge.axis==='parallel'
    ? [e*Math.cos(edge.latitude)/Math.max(1e-8,Math.cos(center.latitude)),n]
    : [n,edge.acrossSign*(e-longitude*Math.sin(center.latitude)*n)];
  const materialAxes=[...toEdge(frame.along),...toEdge(frame.side)];
  return {x,z,tile,frame,phase,materialAxes,segments,edges:edges.map(e=>e.id)};
}
