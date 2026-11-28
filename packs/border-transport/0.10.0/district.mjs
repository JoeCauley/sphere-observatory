// The installation is an addressed stretch of one shared Atlas edge. Coordinates
// are metres along and across the trunk, centered on the middle station.
import {project,unproject} from '../../kit/surface-route.js';
import {sharedEdge,gridDistance,addressAt,edgeCoordinates} from './edges.mjs';
import {ribSpacing} from '../../kit/outfall-wall.mjs';
export const stationHash=text=>{
  let value=2166136261;
  for(const c of text)value=Math.imul(value^c.charCodeAt(0),16777619);
  return value>>>0;
};
const offsets=[-2600,-1820,-800,1050];
export const doorSizes=[[4,4],[18,14],[120,80],[1000,680]];
export const apronShoulderM=5;
export const apronHalfWidthsM=doorSizes.map(([width])=>width/2+apronShoulderM);
export const doorOffset=(seed,i)=>((seed&4)?1:-1)*offsets[i];
const frontageSeed=new WeakMap();
export function plantingDistance(d,lat,lon){
  const p=districtPoint(d,lat,lon),site=nearestSite(d,p.eastM);
  let distance=outsideDistrict(d,p.eastM,p.northM);
  if(!site)return distance;
  const end=Math.abs(p.northM)-site.widthM/2-apronRunM;
  if(end>distance)return distance;
  if(!frontageSeed.has(site))frontageSeed.set(site,stationHash(site.address.key));
  const seed=frontageSeed.get(site);
  // Give each service road its shoulder while leaving soil between entrances.
  for(const [i,half] of apronHalfWidthsM.entries()){
    const lateral=Math.abs(p.eastM-site.x-doorOffset(seed,i))-half;
    distance=Math.min(distance,Math.max(lateral,end));
  }
  return distance;
}
export const spacingM=200000;

export const hallHalfM=16000, linkHalfM=1900, roofSlabM=45;
export const freightSlabDepthM=24;
// Beyond the staffed district only the geographic wall has a local mesh.
export const districtViewReachM=1550000;
// Only the two plots on either side of a commissioned station need to look it up.
// Away from its staffed neighborhood the original chart still addresses the continuous roof.
const districtIndex=new WeakMap();
export function borderAt(border,latitude,longitude){
  if(!border?.districts?.length)return border;
  let byPlot=districtIndex.get(border);
  if(!byPlot){
    byPlot=new Map();
    for(const item of [border,...border.districts]){
      for(const id of item.transport.origin.plots){
        if(!byPlot.has(id))byPlot.set(id,[]);
        byPlot.get(id).push(item);
      }
    }
    districtIndex.set(border,byPlot);
  }
  const plot=globalThis.SphereAtlas.plotAt(latitude,longitude);
  let best=border,nearest=districtViewReachM;
  for(const item of byPlot.get(plot?.id)??[]){
    const d=item.transport,p=districtPoint(d,latitude,longitude),site=nearestSite(d,p.eastM);
    const distance=Math.hypot(Math.max(0,Math.abs(p.eastM-site.x)-hallHalfM),Math.max(0,Math.abs(p.northM)-site.widthM/2));
    if(distance<nearest){best=item;nearest=distance;}
  }
  return best;
}
export const apronRunM=3500, apronBlendM=96, apronTopM=.04;
export const serviceGalleryDepthM=35;
export const stationReleaseDepthM=16;
export const stationBays=[-1,0,1];

// A deep buttress marks each tenth Outfall bay. At the doors all the human-scale
// ribs resolve, with an uninterrupted opening for the surveyed traveler envelope.
export function facadeRib(station,index){
  const x=index*ribSpacing;
  if(Math.abs(x)>hallHalfM-2)return false;
  let clearance=Infinity;
  for(const route of station.routes){
    clearance=Math.min(clearance,Math.abs(x-route.nearDoor[0])-route.door[0]/2);
  }
  return clearance>3 && (index%10===0 || clearance<126);
}

// The inward-facing shell reverses left and right on some canonical edges.
export const rightSign=d=>d.origin.axis==='meridian'?d.origin.acrossSign:-1;
export function nearestSiteIndex(district,x){
  const sites=district.sites;
  let lo=0,hi=sites.length-1;
  while(lo<hi){
    const mid=Math.floor((lo+hi)/2);
    if(x<(sites[mid].x+sites[mid+1].x)/2)hi=mid;else lo=mid+1;
  }
  return lo;
}
export function nearestSite(district,x){
  return district.sites[nearestSiteIndex(district,x)];
}
// Survey sites are sorted by chainage. Skip the rest of a long station register
// even on an edge with no nearby installations.
export function sitesInRange(d,lo,hi){
  const sites=d.sites;
  let start=0,end=sites.length;
  while(start<end){const mid=Math.floor((start+end)/2);if(sites[mid].x<lo)start=mid+1;else end=mid;}
  let last=start;
  while(last<sites.length&&sites[last].x<=hi)last++;
  return sites.slice(start,last);
}
// Atmospheric visibility is measured from the nearest surface of the halls or
// their connecting trunk. The CPU can prepare and release their mesh beyond
// the visible interval without turning a complete silhouette on or off.
export function meadowStationVisibility(d,x,z,height){
  const index=nearestSiteIndex(d,x),site=d.sites[index];
  const above=Math.max(0,height-(site?.roofM??1700)-roofSlabM);
  let range=Math.hypot(Math.max(0,wallDistance(d,x,z)),above);
  // The closest addressed bay can change before its wider neighbor ceases to
  // be the nearest visible surface. Keep the atmospheric weight continuous.
  for(const bay of sitesInRange(d,x-226000,x+226000)){
    const along=Math.max(0,Math.abs(x-bay.x)-hallHalfM);
    if(along<range)range=Math.min(range,Math.hypot(along,Math.max(0,Math.abs(z)-bay.widthM/2),
      Math.max(0,height-bay.roofM-roofSlabM)));
  }
  const t=Math.min(1,Math.max(0,(range-64000)/96000));
  return {index,range,opacity:1-t*t*(3-2*t)};
}
export function latitudeGap(district,latitude){
  return Math.max(0,Math.abs(latitude)-globalThis.SphereAtlas.LIMIT)*district.origin.radiusM/1000;
}
const installedEdges=new WeakMap();
export function installedEdge(d){
  let edge=installedEdges.get(d);
  if(!edge){const a=d.origin;edge=sharedEdge(...a.plots,a.radiusM);installedEdges.set(d,edge);}
  return edge;
}
export function wallAddress(d,x,z){
  const ll=districtLocation(d,x,z);
  return addressAt(ll.latitude,ll.longitude,d.origin.radiusM);
}
// Leave room for the historic grove within the existing right of way. The
// shoulder widens at one metre per two metres along the edge on either approach.
export function frontageLimit(field,along){
  return Math.min(linkHalfM,field.innerM+.5*Math.max(0,Math.abs(along-field.alongM)-field.halfM));
}
export function wallDistance(d,x,z){
  const edge=installedEdge(d);
  // In this central rectangle the host edge is the nearest grid line.
  // Its chart is accurate at station scale, including sub-millimetre jambs.
  const f=d.mineralFrontage;
  if(Math.abs(x)+Math.abs(z)<edge.lengthM*.22 && (!f || f.edge.id!==edge.id))return Math.abs(z)-linkHalfM;
  const ll=districtLocation(d,x,z),r=d.origin.radiusM;
  const band=gridDistance(ll.latitude,ll.longitude,r)-linkHalfM;
  const reach=f?f.halfM+2*(linkHalfM-f.innerM)+linkHalfM:0;
  if(!f || Math.abs(ll.latitude-f.latitude)*r>reach ||
    Math.abs(Math.atan2(Math.sin(ll.longitude-f.longitude),Math.cos(ll.longitude-f.longitude)))*Math.cos(f.latitude)*r>reach)return band;
  const p=edgeCoordinates(f.edge,ll.latitude,ll.longitude);
  const limit=frontageLimit(f,p.alongM);
  if(limit>=linkHalfM)return band;
  const slope=Math.abs(p.alongM-f.alongM)>f.halfM ? .5 : 0;
  return Math.max(band,(f.side*p.acrossM-limit)/Math.hypot(1,slope));
}
// Preserve chart scale and avoid a large-coordinate subtraction in a shader.
// Latitude rows are small circles; chainage follows the actual shared parallel.
export function districtPoint(d,lat,lon){
  const a=d.origin,r=a.radiusM;
  if(a.axis==='parallel')return {eastM:Math.atan2(Math.sin(lon-a.longitude),Math.cos(lon-a.longitude))*r*Math.cos(a.latitude),northM:(lat-a.latitude)*r};
  const p=project(a,lat,lon,r);return {eastM:p.northM,northM:p.eastM*a.acrossSign};
}
// A metre on the distant side of an azimuthal map can span several chart metres.
export function shellDisplacement(d,p,forwardM,rightM){
  const sin=Math.sin(p.yaw),cos=Math.cos(p.yaw),dx=forwardM*sin+rightM*cos,dz=forwardM*cos-rightM*sin;
  const r=d.origin.radiusM;
  if(!Math.hypot(dx,dz)||Math.hypot(p.eastM,p.northM)<r*.0001)return {eastM:dx,northM:dz};
  const center=districtLocation(d,p.eastM,p.northM);
  const axis=(x,z)=>{
    const g=districtLocation(d,p.eastM+x*1000,p.northM+z*1000);
    return project(center,g.latitude,g.longitude,r);
  };
  const along=axis(sin,cos),right=axis(cos,-sin),length=Math.hypot(along.eastM,along.northM);
  if(!length)return {eastM:0,northM:0};
  const e=along.eastM/length,n=along.northM/length,side=Math.sign(n*right.eastM-e*right.northM);
  const dest=unproject(center,forwardM*e+rightM*n*side,forwardM*n-rightM*e*side,r);
  const target=districtPoint(d,dest.latitude,dest.longitude);
  return {eastM:target.eastM-p.eastM,northM:target.northM-p.northM};
}
export function districtLocation(d,x,z){
  const a=d.origin,r=a.radiusM;
  if(a.axis==='parallel'){
    const lon=a.longitude+x/(r*Math.cos(a.latitude));
    return {latitude:a.latitude+z/r,longitude:Math.atan2(Math.sin(lon),Math.cos(lon))};
  }
  return unproject(a,z*a.acrossSign,x,r);
}
// Signed distance from the paving. Both terrain and obstruction generation use the same surveyed rectangle.
export function apronDistance(d,lat,lon){
  const p=districtPoint(d,lat,lon),site=nearestSite(d,p.eastM);
  if(!site)return Infinity;
  return Math.max(Math.abs(p.eastM-site.x)-hallHalfM,Math.abs(p.northM)-site.widthM/2-apronRunM);
}
// Negative distances are inside the union. Real adjoining aprons provide an overlap for ownership.
export function outsideDistrict(d,x,z){
  const site=nearestSite(d,x);
  const hall=site?Math.max(Math.abs(x-site.x)-hallHalfM,Math.abs(z)-site.widthM/2):Infinity;
  return Math.min(hall,wallDistance(d,x,z));
}

// Both scenes draw the same service gallery. Keep the outside renderer alive
// across the jamb; exchange cameras at the inner end of the enclosed passage.
export function outsideStationScene(d,x,z,height,departing=false){
  const distance=outsideDistrict(d,x,z);
  // A departing traveller must clear the jamb or head by a fraction of a
  // metre. Otherwise a sideways step can exchange owners twice at one depth.
  const margin=departing ? .6 : 0,limit=departing ? stationReleaseDepthM : serviceGalleryDepthM;
  if(distance>apronRunM || distance < -limit)return distance-margin;
  const site=nearestSite(d,x);
  if(!site)return distance-margin;
  if(!frontageSeed.has(site))frontageSeed.set(site,stationHash(site.address.key));
  const depth=site.widthM/2-Math.abs(z);
  if(depth>limit)return distance-margin;
  const seed=frontageSeed.get(site);
  for(const [index,[width,top]] of doorSizes.entries()){
    // The service gallery widens past its jamb. The other surveyed openings
    // continue at their full clear width over the level entrance deck.
    const half=index===0 && depth>1?5.5:width/2,ceiling=index===0 && depth>1?7.3:top;
    if(height<ceiling-margin && Math.abs(x-site.x-doorOffset(seed,index))<half-margin)
      return Math.max(distance-margin,limit-depth);
  }
  return distance-margin;
}
