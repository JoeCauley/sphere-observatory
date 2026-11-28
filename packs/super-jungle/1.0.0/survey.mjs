import {districtLocation,districtPoint,plantingDistance} from '../../border-transport/0.10.0/district.mjs';
import {generateStation} from '../../border-transport/0.10.0/station.mjs';
import {project,unproject} from '../../kit/surface-route.js';

// The native ground worker plants one tree at a qualifying point of the
// 128 m Cartesian lattice. Survey that lattice before selecting a landmark.
export function surveyJungle(state,district,meadowPlot,host=globalThis){
  if(!district)return null;
  const bay=district.sites.find(s=>s.bay===0);
  if(!bay)return null;
  const station=generateStation(bay.address),idx=bay.address.plots.indexOf(meadowPlot);
  const side=idx===1?-1:1,door=station.routes[0].nearDoor[0],face=side*station.widthM/2;
  const ll=(x,fromDoor)=>districtLocation(district,door+x,face+fromDoor*side);
  const coords=g=>{
    const p=districtPoint(district,g.lat,g.lon);
    return {...p,along:p.eastM-door,out:(p.northM-face)*side};
  };
  return surveyStand(state,host,ll,coords,(g,r)=>plantingDistance(district,g.lat,g.lon)>=r+2,{
    id:'jungle/'+bay.address.key+'/service/'+side,station:bay.address.key,side,threshold:{...ll(0,0),eastM:door,northM:face}
  });
}

// This second occurrence uses the native locator and a fixed offset into the
// habitat. Its trees and clearings come from the same physical planting cells.
export function surveyJungleGrove(state,host=globalThis,district=null,offset={eastM:8000,northM:12000}){
  const W=host.SphereWorld,r=state.radius*1000,g=W.coordinates(W.locateBiome(1,state,{sunlit:false}),state);
  const site=unproject({latitude:g.lat,longitude:g.lon},offset.eastM,offset.northM,r);
  const ll=(x,z)=>unproject(site,x,z,r);
  const coords=g=>{
    const p=project(site,g.lat,g.lon,r);
    return {...p,along:p.eastM,out:p.northM};
  };
  const safe=(g,radiusM)=>{
    if(district&&plantingDistance(district,g.lat,g.lon)<radiusM+2)return false;
    const q=W.direction(g.lat,g.lon,state),province=host.SphereWatershed?.sample(q,state);
    return !host.SphereMath.inBreach(q,state)&&!host.SphereCollection.missing(q,state)&&!province?.water?.river&&!province?.water?.basin&&!province?.route;
  };
  const stand=surveyStand(state,host,ll,coords,safe,{source:'native-grove'});
  if(stand)stand.occurrence.id='jungle/grove/'+stand.occurrence.tree.id;
  return stand;
}

function surveyStand(state,host,ll,coords,canPlant,address){
  const {SphereWorld:W,SphereMath:M,SphereSites:S,SphereGeography:G,SphereAtlas:A}=host;
  const ray=g=>W.direction(g.latitude,g.longitude,state);
  const habitat=q=>G?.query(q,{state,representation:"walking"}).biome??W.sample(q,state).biome;
  const samples=[4,120,300,510,830].map(m=>habitat(ray(ll(0,m))));
  if(samples.some(id=>id!==1))return null;
  const center=ll(0,630),r=state.radius,pitch=.128;
  const corners=[];
  for(const x of [-350,350])for(const z of [300,930])corners.push(M.mul(ray(ll(x,z)),r));
  const bounds=[0,1,2].map(i=>[Math.floor(Math.min(...corners.map(q=>q[i]))/pitch)-1,Math.floor(Math.max(...corners.map(q=>q[i]))/pitch)+1]);
  const trees=[];
  for(let ix=bounds[0][0];ix<=bounds[0][1];ix++)for(let iy=bounds[1][0];iy<=bounds[1][1];iy++)for(let iz=bounds[2][0];iz<=bounds[2][1];iz++){
    const pos=[ix,iy,iz].map(i=>(i+.5)*pitch);
    if(Math.abs(M.length(pos)-r)>.055)continue;
    const density=S.noise(ix,iy,state.seed+iz);if(density>.64)continue;
    const q=M.norm(pos),g=W.coordinates(q,state),p=coords(g);
    const {along,out}=p;
    if(Math.abs(along)>345||out<305||out>925||habitat(q)!==1)continue;
    const radiusM=13+12*S.noise(ix,iz,state.seed+iy);
    if(!canPlant(g,radiusM))continue;
    trees.push({id:[state.seed,ix,iy,iz].join(':'),latitude:g.lat,longitude:g.lon,
      eastM:p.eastM,northM:p.northM,along,out,radiusM,heightM:25+31*density});
  }
  const mature=trees.filter(t=>t.heightM>=35&&Math.abs(t.along)<235&&t.out>510&&t.out<805);
  mature.sort((a,b)=>Math.hypot(a.along-48,a.out-615)-Math.hypot(b.along-48,b.out-615)||a.id.localeCompare(b.id));
  const tree=mature[0];if(!tree)return null;
  let gap;
  for(let x=tree.along-70;x<=tree.along+70;x+=8)for(let z=tree.out-100;z<=tree.out-30;z+=8){
    const clearance=Math.min(...trees.map(t=>Math.hypot(x-t.along,z-t.out)-t.radiusM*1.55));
    const score=clearance-.45*Math.hypot(x-tree.along,z-(tree.out-65));
    if(clearance>10&&(!gap||score>gap.score))gap={...ll(x,z),along:x,out:z,clearance,score};
  }
  if(!gap)return null;
  const occurrence={kind:'habitat',biome:1,...address,...center,angularRadius:3200/(r*1000),tree,gap,samples};
  for(const point of [occurrence.tree,occurrence.gap]){
    point.local=project(center,point.latitude,point.longitude,r*1000);
  }
  const plot=A.plotAt(center.latitude,center.longitude);
  return {plot,direction:ray(center),occurrence};
}
