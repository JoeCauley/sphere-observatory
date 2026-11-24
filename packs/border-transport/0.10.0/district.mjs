// The installation is an addressed stretch of one shared Atlas edge. Coordinates
// are metres along and across the trunk, centered on the middle station.
import {project,unproject} from '../../kit/surface-route.js';
import {ribSpacing} from '../../kit/outfall-wall.mjs';
export const stationHash=text=>{
  let value=2166136261;
  for(const c of text)value=Math.imul(value^c.charCodeAt(0),16777619);
  return value>>>0;
};
const offsets=[-2600,-1820,-800,1050];
export const doorSizes=[[4,4],[18,14],[120,80],[1000,680]];
export const doorOffset=(seed,i)=>((seed&4)?1:-1)*offsets[i];
const frontageSeed=new WeakMap();
export function plantingDistance(d,lat,lon){
  const p=districtPoint(d,lat,lon),site=nearestSite(d,p.eastM);
  let distance=outsideDistrict(d,p.eastM,p.northM);
  const end=Math.abs(p.northM)-site.widthM/2-apronRunM;
  if(end>distance)return distance;
  if(!frontageSeed.has(site))frontageSeed.set(site,stationHash(site.address.key));
  const seed=frontageSeed.get(site);
  // Give each service road its shoulder while leaving soil between entrances.
  for(const [i,half] of [7,14,65,505].entries()){
    const lateral=Math.abs(p.eastM-site.x-doorOffset(seed,i))-half;
    distance=Math.min(distance,Math.max(lateral,end));
  }
  return distance;
}
export const spacingM=200000;

export const hallHalfM=16000, linkHalfM=1900, roofSlabM=45;
export const apronRunM=3500, apronBlendM=96;
export const serviceGalleryDepthM=35;
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
export function latitudeGap(district,latitude){
  const {origin,sites}=district;
  if(origin.axis==='parallel')return Math.abs(latitude-origin.latitude)*origin.radiusM/1000;
  const a=sites[0].address.latitude,b=sites.at(-1).address.latitude;
  return Math.max(0,a-latitude,latitude-b)*origin.radiusM/1000;
}
// Preserve chart scale and avoid a large-coordinate subtraction in a shader.
// Latitude rows are small circles; chainage follows the actual shared parallel.
export function districtPoint(d,lat,lon){
  const a=d.origin,r=a.radiusM;
  if(a.axis==='parallel')return {eastM:Math.atan2(Math.sin(lon-a.longitude),Math.cos(lon-a.longitude))*r*Math.cos(a.latitude),northM:(lat-a.latitude)*r};
  const p=project(a,lat,lon,r);return {eastM:p.northM,northM:p.eastM*a.acrossSign};
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
  return Math.max(Math.abs(p.eastM-site.x)-hallHalfM,Math.abs(p.northM)-site.widthM/2-apronRunM);
}
// Negative distances are inside the union. Real adjoining aprons provide an overlap for ownership.
export function outsideDistrict(d,x,z){
  const site=nearestSite(d,x);
  const hall=Math.max(Math.abs(x-site.x)-hallHalfM,Math.abs(z)-site.widthM/2);
  const ends=d.sites;
  const link=Math.max(ends[0].x-x,x-ends.at(-1).x,Math.abs(z)-linkHalfM);
  return Math.min(hall,link);
}

// Both scenes draw the same service gallery. Keep the outside renderer alive
// across the jamb; exchange cameras at the inner end of the enclosed passage.
export function outsideStationScene(d,x,z,height){
  const distance=outsideDistrict(d,x,z);
  if(distance>apronRunM || distance < -serviceGalleryDepthM)return distance;
  const site=nearestSite(d,x);
  if(!frontageSeed.has(site))frontageSeed.set(site,stationHash(site.address.key));
  const depth=site.widthM/2-Math.abs(z);
  if(depth>serviceGalleryDepthM)return distance;
  const seed=frontageSeed.get(site);
  for(const [index,[width,top]] of doorSizes.entries()){
    // The service gallery widens past its jamb. The other surveyed openings
    // continue at their full clear width over the level entrance deck.
    const half=index===0 && depth>1?5.5:width/2,ceiling=index===0 && depth>1?7.3:top;
    if(height<ceiling && Math.abs(x-site.x-doorOffset(seed,index))<half)
      return Math.max(distance,serviceGalleryDepthM-depth);
  }
  return distance;
}
