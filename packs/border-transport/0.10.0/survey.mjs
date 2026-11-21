import {addressOf,stationDimensions} from './station.mjs';
import {spacingM,stationBays} from './district.mjs';
export {hallHalfM} from './district.mjs';

export function districtFor(world,near,far,radius,preview=stationDimensions){
  const origin=addressOf(world,near,far,0,radius);
  const sites=[];
  for(const bay of stationBays){
    let address;
    try{address=addressOf(world,near,far,bay,radius);}catch(err){if(bay===0)throw err;continue;}
    const {widthM,roofM}=preview(address);
    sites.push({bay,x:bay*spacingM,widthM,roofM,address});
  }
  return {schema:1,origin,sites};
}
