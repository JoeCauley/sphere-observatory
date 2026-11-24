import {outsideDistrict, roofSlabM} from './district.mjs';
import {inFreightOpening} from './freight-bay.mjs';

// One addressed station and its adjoining link. Coordinates and elevations are metres.
// The negative and positive faces follow the canonical order of the station's plots.
export function borderEnvironment(district, station, pose) {
  const {address} = station;
  const x = pose.eastM - address.chainageM;
  const z = pose.northM;
  if (outsideDistrict(district,pose.eastM,z) > 0) {
    const plot = address.plots[z < 0 ? 0 : 1];
    return {zone:'biome', air:plot, blind:plot};
  }
  if (pose.altitudeM >= station.roofM + roofSlabM)
    return {zone:'roof', air:'vacuum', blind:null};
  if (inFreightOpening(x,z) && pose.altitudeM >= 0)
    return {zone:'freight well', air:'vacuum', blind:null};
  return {zone:'interior', air:'station', blind:null};
}
