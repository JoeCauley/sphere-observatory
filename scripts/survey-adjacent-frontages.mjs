import fs from 'node:fs';
import {createRequire} from 'node:module';
import {districtFor} from '../packs/border-transport/0.10.0/survey.mjs';
import {districtLocation} from '../packs/border-transport/0.10.0/district.mjs';
import {generateStation} from '../packs/border-transport/0.10.0/station.mjs';
import {sharedEdge} from '../packs/border-transport/0.10.0/edges.mjs';
import {canStand} from '../portal-landing.js';
import {unproject} from '../packs/kit/surface-route.js';
import {createFacility} from '../packs/infinite-industry/1.4.1/facility.js';
import {cell,CELL} from '../packs/sideways-city/1.0.0/ground.js';
const require=createRequire(import.meta.url);
for(const n of ['math','collection','biomes','world-palette','world','field-sites','flight','surface-walk'])require('../'+n+'.js');
const [register,output]=process.argv.slice(2),key='sphere-ed6a59ab491a9a08',entry=JSON.parse(fs.readFileSync(register,'utf8')).worlds[key];
const M=SphereMath,W=SphereWorld,A=SphereAtlas,s={...M.defaultState(),...entry.parameters,seed:713,collection:true};
const r=s.radius*1000,items=entry.installed.filter(i=>i.detailInstalled!==false),env={atlas:A,world:W},ray=g=>W.direction(g.latitude,g.longitude,s);
const angle=(a,b)=>Math.atan2(M.length(M.cross(a,b)),M.dot(a,b));
const distance=(a,b)=>angle(ray(a),ray(b))*s.radius;
function nearest(g,i){
 if(i.occurrence)return Math.max(0,distance(g,i.occurrence)-i.occurrence.angularRadius*s.radius);
 const p=A.byId(i.plotId),lat=p.halfHeight*(i.footprint?.north??1),lon=Math.PI/p.columns*(i.footprint?.east??1);
 if(i.footprint?.shape==='ellipse')throw Error('This survey expects the historic register or rectangular sites.');
 const dl=Math.atan2(Math.sin(g.longitude-p.longitude),Math.cos(g.longitude-p.longitude)),d=Math.max(-lon,Math.min(lon,dl));
 const best=Math.atan2(Math.sin(g.latitude),Math.cos(g.latitude)*Math.cos(dl-d));
 return distance(g,{latitude:Math.max(p.latitude-lat,Math.min(p.latitude+lat,best)),longitude:p.longitude+d});
}
function occupants(g){
 const q=ray(g),native=W.sample(q,s),site=A.regionAt(items,g.latitude,g.longitude,()=>native.biome);
 return {native:native.name,biome:native.biome,site:site?.id??null,plot:A.plotAt(g.latitude,g.longitude)?.id};
}
function soundLine(d,face,x,sign){
 const point=m=>districtLocation(d,x,sign*(face+m)),start=point(1),owner=occupants(start),q=ray(start);
 const terrain={...s,siteId:'biome-'+owner.biome,siteRevision:2,terrainRevision:2,siteAnchor:q,terrainAnchor:q,
  geometryDetail:true,position:M.mul(q,s.radius-.002)};
 let frame;if(!owner.site){SphereGround.neighbourhood(terrain);frame=SphereGround.frame(terrain);}
 let last=0;
 for(let m=0;m<=400;m+=2){
  const a=point(m),v=ray(a),o=occupants(a);
  if(o.site!==owner.site||o.biome!==owner.biome||M.inBreach(v,s)||SphereCollection.missing(v,s))break;
  if(owner.site){if(!canStand(v,owner.site,s,items,env,.8))break;}
  else{
   const local=frame.local(M.mul(v,s.radius)),next=frame.local(M.mul(ray(point(m+2)),s.radius));
   const [xx,,zz]=local,h=SphereGround.height(terrain,frame,xx,zz),step=M.norm([next[0]-xx,0,next[2]-zz]);
   const facing=M.norm(frame.basis.reduce((a,b,i)=>M.add(a,M.mul(b,step[i])),[0,0,0]));
   let blocked=false;
   for(const side of [-.0005,0,.0005]){
    const eye=frame.world([xx+step[2]*side,h+.00172,zz-step[0]*side]),hit=SphereLanding.probe(terrain,eye,facing,.0021);
    if(hit.distance<.002&&hit.normal&&Math.abs(M.dot(hit.normal,q))<.87){blocked=true;break;}
   }
   if(blocked)break;
  }
  last=m;
 }
 return {...owner,clearApproachM:last,door:point(0),samples:[4,120,300,400].map(m=>({outM:m,...occupants(point(m))}))};
}
const candidates=[];
for(const installed of items.filter(i=>['sideways-city','infinite-industry'].includes(i.id))){
 const plot=A.byId(installed.plotId);
 const neighbors=new Set([A.byId('r'+plot.row+'c'+((plot.col+1)%plot.columns)).id,A.byId('r'+plot.row+'c'+((plot.col+plot.columns-1)%plot.columns)).id]);
 for(const side of [-1,1])for(const fraction of [-.7,0,.7])neighbors.add(A.plotAt(plot.latitude+side*(plot.halfHeight+1e-7),plot.longitude+fraction*Math.PI/plot.columns).id);
 for(const nid of neighbors){
  let d;try{d=districtFor(key,plot.id,nid,r);}catch{continue;}
  const st=generateStation(d.origin),face=st.widthM/2,x=st.routes[0].nearDoor[0];
  const a=soundLine(d,face,x,-1),b=soundLine(d,face,x,1);if(a.site===b.site)continue;
  const midpoint=districtLocation(d,x,0),caps=items.filter(i=>!i.edge).map(i=>({name:i.name,plot:i.plotId,km:nearest(midpoint,i)})).sort((a,b)=>a.km-b.km);
  candidates.push({edge:d.origin.plots.join('/'),axis:d.origin.axis,midpoint,wallKm:sharedEdge(...d.origin.plots,r).lengthM/1000,hallWidthKm:st.widthM/1000,serviceAlongM:x,sides:[a,b],nearestInstalled:caps});
 }
}
candidates.sort((a,b)=>Math.min(...b.sides.map(t=>t.clearApproachM))-Math.min(...a.sides.map(t=>t.clearApproachM)) || a.edge.localeCompare(b.edge));
const selected=candidates[0];if(!selected||selected.sides.some(v=>v.clearApproachM<80))throw Error('No candidate with clear access on both sides');
const city=items.find(i=>i.id==='sideways-city'),industry=items.find(i=>i.id==='infinite-industry'),f=createFacility(),plaza=[];
for(let x=-8;x<=8;x++)for(let z=-8;z<=8;z++)if(cell(x,z).kind==='plaza')plaza.push({eastM:x*CELL,northM:z*CELL});
plaza.sort((a,b)=>Math.hypot(a.eastM,a.northM)-Math.hypot(b.eastM,b.northM));
const terminal=(i,p)=>{
 const chart=A.byId(i.plotId),at=(x,z)=>unproject(chart,x,z,r),g=at(p.eastM,p.northM);
 if(!canStand(ray(g),i.id,s,items,env,.8))throw Error('The proposed terminal is blocked.');
 let lane={clearM:0};
 for(let heading=0;heading<360;heading+=45){
   const a=heading*Math.PI/180;let clearM=0;
   for(let m=1;m<=100;m++){
     const sample=at(p.eastM+m*Math.sin(a),p.northM+m*Math.cos(a));
     if(!canStand(ray(sample),i.id,s,items,env,.8))break;
     clearM=m;
   }
   if(clearM>lane.clearM)lane={clearM,outwardBearing:heading,
     startLocal:{eastM:p.eastM+clearM*Math.sin(a),northM:p.northM+clearM*Math.cos(a)}};
 }
 return {id:i.id,plot:i.plotId,eastM:p.eastM,northM:p.northM,...g,lane};
};
const it=terminal(industry,f.arrival),ct=terminal(city,plaza[0]),theta=angle(ray(it),ray(ct));
const result={world:key,selected,candidatesChecked:candidates.length,span:{industry:it,city:ct,surfaceDistanceKm:theta*s.radius,chordKm:2*s.radius*Math.sin(theta/2)},
 footprintSource:'Stored seed-713 install records. A legacy record without footprint is owned by the full Atlas cell. The authored plant and plaza sit inside those cells.',
 sampling:'Proposed frontages use generated Bay 0 dimensions and service-door chainage. Check every 2 m for 400 m outward. Native side uses three eye-level collision rays. Installed side uses its native walking solids with an 0.8 m margin.'};
fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(selected.edge,selected.sides.map(v=>[v.site??v.native,v.clearApproachM]),result.span.surfaceDistanceKm);

