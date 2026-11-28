import {addressOf,stationDimensions} from './station.mjs';
import {addressAt} from './edges.mjs';
import {spacingM,stationBays,linkHalfM} from './district.mjs';
export {hallHalfM} from './district.mjs';

// The historic Violet field can sit on a plot line. Survey a side opening
// against its real position and retain the opposite roof and foundation.
export function mineralFrontage(state,world){
  if(!world?.locateBiome)return null;
  const anchor=world.locateBiome(9,state,{sunlit:false}),g=world.coordinates(anchor,state),r=state.radius*1000;
  const at=addressAt(g.lat,g.lon,r),half=1600;
  const side=at.acrossM<-.01?-1:1,shoulderRun=2*(linkHalfM+half-side*at.acrossM);
  if(at.distanceM>linkHalfM+half || Math.abs(at.alongM)+half+shoulderRun+linkHalfM>=at.edge.lengthM/2)return null;
  return {id:'violet-reference',edge:at.edge,alongM:at.alongM,halfM:half,side,innerM:side*at.acrossM-half,latitude:g.lat,longitude:g.lon};
}

export function districtFor(world,near,far,radius,preview=stationDimensions,bays=stationBays){
  const origin=addressOf(world,near,far,0,radius);
  const sites=[];
  for(const bay of bays){
    let address;
    try{address=addressOf(world,near,far,bay,radius);}catch(err){if(bay===0)throw err;continue;}
    const {widthM,roofM}=preview(address);
    sites.push({bay,x:bay*spacingM,widthM,roofM,address});
  }
  return {schema:1,origin,sites};
}
