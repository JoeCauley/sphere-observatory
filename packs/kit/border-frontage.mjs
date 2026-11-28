import {pointOnEdge} from '../border-transport/0.10.0/edges.mjs';

// Door sockets use station coordinates (z=0 or z=widthM). Approaching a
// different opening, turning round, or walking backwards never swaps the face.
export function stationMouth(station,x,z){
  const side=z<station.widthM/2?0:1;
  let best=null;
  for(const route of station.routes){
    const socket=side===0?route.nearDoor:route.farDoor;
    const lateral=Math.max(0,Math.abs(x-socket[0])-route.door[0]/2);
    if(!best || lateral<best.lateral)best={side,route,socket,lateral,depth:(side===0?1:-1)*(z-socket[2])};
  }
  return best;
}

// Sample beyond the physical face. Along and setback are metres on the addressed
// edge. Side is the index into its canonical plot pair, even across the date line.
export function borderFrontage(edge,side,alongM,setbackM,items,pack,nativeAt){
  if((side!==0 && side!==1) || !Number.isFinite(alongM) || Math.abs(alongM)>edge.lengthM/2 ||
     !Number.isFinite(setbackM) || setbackM<=0)throw RangeError('A point on the shared edge and a positive setback are required.');
  const sign=(side===0?-1:1)*(edge.plots[1]==='polar-south'?-1:1);
  const {latitude,longitude}=pointOnEdge(edge,alongM,sign*setbackM);
  const native=nativeAt(latitude,longitude);
  const item=globalThis.SphereAtlas.regionAt(items,latitude,longitude,()=>native.biome);
  const definition=item && pack(item.packId);
  const requested=definition?.border?.profile??(item&&!item.occurrence?'plain':native.biome===1?'jungle':'plain');
  const profile=['plain','meadow','jungle'].includes(requested)?requested:'plain';
  return {edgeId:edge.id,plotId:edge.plots[side],side,alongM,latitude,longitude,
    instanceId:item?.id??null,name:item?.name??native.name,canEnterPack:!!item && item.detailInstalled!==false,
    profile,albedo:definition?.overview?.albedo??native.color,nativeBiome:native.biome,
    exterior:item?.detailInstalled!==false&&definition?.border?.exterior||null};
}

export function nativeFrontageTerrain(face,state,world){
  const anchor=world.direction(face.latitude,face.longitude,state);
  return {siteId:'biome-'+face.nativeBiome,siteAnchor:anchor,terrainAnchor:anchor,siteRevision:2,terrainRevision:2,
    siteElevation:0,geometryDetail:true,collection:true,viewMode:'material',projection:'perspective'};
}
