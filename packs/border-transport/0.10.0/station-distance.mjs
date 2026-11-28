import {edgesOf,pointOnEdge} from './edges.mjs';
import {installedEdge,nearestSite} from './district.mjs';

const surveys=new WeakMap();
const tau=2*Math.PI;
// Adjacent rows subdivide a parallel at different longitudes. Their shared endpoints
// must refer to the same junction, including the two representations of the date line.
function junctionKey(point,atlas){
  const row=Math.round((point.latitude+atlas.LIMIT)/atlas.ROW);
  const turn=Math.round((point.longitude/tau+.5)*1e10);
  return row+'/'+((turn%1e10+1e10)%1e10);
}

function stationNetwork(district){
  const atlas=globalThis.SphereAtlas,edges=new Map(),junctions=new Map();
  function junction(point){
    const key=junctionKey(point,atlas);
    if(!junctions.has(key))junctions.set(key,{links:[],distanceM:Infinity,site:null});
    return junctions.get(key);
  }
  for(let i=0;i<atlas.TOTAL;i++){
    for(const edge of edgesOf(atlas.plot(i),district.origin.radiusM)){
      if(edges.has(edge.id))continue;
      const a=junction(pointOnEdge(edge,-edge.lengthM/2)),b=junction(pointOnEdge(edge,edge.lengthM/2));
      edges.set(edge.id,[a,b]);
      a.links.push([b,edge.lengthM]);b.links.push([a,edge.lengthM]);
    }
  }
  const pending=[];
  function offer(node,distanceM,site){
    if(distanceM>=node.distanceM)return;
    node.distanceM=distanceM;node.site=site;
    // Keep the smallest candidate at the end. This queue contains only the frontier.
    let lo=0,hi=pending.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(pending[mid].distanceM>distanceM)lo=mid+1;else hi=mid;}
    pending.splice(lo,0,{node,distanceM});
  }
  const home=installedEdge(district),[west,east]=edges.get(home.id);
  for(const site of district.sites){
    offer(west,home.lengthM/2+site.x,site);offer(east,home.lengthM/2-site.x,site);
  }
  while(pending.length){
    const {node,distanceM}=pending.pop();
    if(distanceM!==node.distanceM)continue;
    for(const [next,length] of node.links)offer(next,distanceM+length,node.site);
  }
  return edges;
}

// Distance from this edge centreline to the centre of a surveyed bay along connected roofs.
export function nearestStationByWall(district,address){
  if(!district.sites.length)return null;
  const {edge}=address,alongM=Math.max(-edge.lengthM/2,Math.min(edge.lengthM/2,address.alongM));
  if(edge.id===installedEdge(district).id){
    const site=nearestSite(district,alongM);
    return {site,distanceM:Math.abs(alongM-site.x)};
  }
  if(!surveys.has(district))surveys.set(district,stationNetwork(district));
  const [a,b]=surveys.get(district).get(edge.id);
  const viaA=a.distanceM+edge.lengthM/2+alongM,viaB=b.distanceM+edge.lengthM/2-alongM;
  return viaA<=viaB?{site:a.site,distanceM:viaA}:{site:b.site,distanceM:viaB};
}
