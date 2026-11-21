// The installation is an addressed stretch of one shared Atlas edge. Coordinates
// are metres along and across the trunk, centered on the middle station.
import {project,unproject} from '../../kit/surface-route.js';
export const spacingM=200000;

export const hallHalfM=16000, linkHalfM=1900, roofSlabM=45;
export const stationBays=[-1,0,1];

// The inward-facing shell reverses left and right on some canonical edges.
export const rightSign=d=>d.origin.axis==='meridian'?d.origin.acrossSign:-1;
export function nearestSite(district,x){
  const sites=district.sites;
  const index=Math.max(0,Math.min(sites.length-1,Math.round(x/spacingM)-sites[0].bay));
  return sites[index];
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
// Negative distances are inside the union. Real adjoining aprons provide an overlap for ownership.
export function outsideDistrict(d,x,z){
  const site=nearestSite(d,x);
  const hall=Math.max(Math.abs(x-site.x)-hallHalfM,Math.abs(z)-site.widthM/2);
  const ends=d.sites;
  const link=Math.max(ends[0].x-x,x-ends.at(-1).x,Math.abs(z)-linkHalfM);
  return Math.min(hall,link);
}
