import {eye} from './model.js';
import {roofM,tunnelStartM,widthM} from '../../kit/border-profile.js';

// Each interval is [west, east, bottom, top, front, back], in metres.
// Rendering and movement both use these intervals, including the unbounded ends.
export const wallHeight = roofM;
// The cross-gallery opens into a straight through-passage. All dimensions are metres.
export const tunnelStart = tunnelStartM, tunnelLength = widthM, tunnelEnd = tunnelStart+tunnelLength;
export const tunnelHalfWidth = 3.5, tunnelHeight = 6.2;
export const ribSpacing = 18;
export const ribs = [[.725, 106, -1.05, 1.05], [.225, 34, -1.825, -.475]];
export const pipes = [3.8, 5.8];
export const borderSolids = [
  [-Infinity, -6, 0, wallHeight, 0, 34],
  [6, Infinity, 0, wallHeight, 0, 34],
  [-6, 6, 8, wallHeight, 0, 34],
  [-Infinity, Infinity, 7.8, wallHeight, 34, 43],
  [-Infinity, -6, 0, wallHeight, 43, 73],
  [6, Infinity, 0, wallHeight, 43, 73],
  [-6, 6, 8, wallHeight, 43, 73],
  [-6, -tunnelHalfWidth, 0, 8, tunnelStart, 73],
  [tunnelHalfWidth, 6, 0, 8, tunnelStart, 73],
  [-tunnelHalfWidth,tunnelHalfWidth,tunnelHeight,8,tunnelStart,73],
  [-Infinity,-tunnelHalfWidth,0,wallHeight,73,tunnelEnd],
  [tunnelHalfWidth,Infinity,0,wallHeight,73,tunnelEnd],
  [-tunnelHalfWidth,tunnelHalfWidth,tunnelHeight,wallHeight,73,tunnelEnd]
];

const radius = .22, head = .10, tolerance = 1e-6;
const margins = [[radius, radius], [head, eye], [radius, radius]];
const flatGround=()=>0;
const fields = ['eastM', 'altitudeM', 'northM'];
function nearby(boxes, p) {
  if (p.northM < -3 || p.northM > 2 || p.altitudeM > 108) return boxes;
  const center = Math.round(p.eastM / ribSpacing), local = boxes.slice();
  for (let k = center-1; k <= center+1; k++) {
    if (k === 0) continue;
    for (const [w,h,f,g] of ribs) local.push([k*ribSpacing-w,k*ribSpacing+w,0,h,f,g]);
  }
  return local;
}
function insideAxis(p, box, axis) {
  const v = p[fields[axis]];
  return v > box[2 * axis] - margins[axis][0] + tolerance &&
    v < box[2 * axis + 1] + margins[axis][1] - tolerance;
}
export function solidAt(boxes, x, y, z, groundAt=flatGround) {
  const p = {eastM:x, altitudeM:y, northM:z};
  return y < groundAt(x,z)+eye - tolerance || nearby(boxes,p).some(box => [0, 1, 2].every(axis => insideAxis(p, box, axis)));
}
// Sweep the body one axis at a time. A fast descent stops on the first roof or
// floor it encounters, and a diagonal approach can slide along a wall.
function sweep(p, boxes, axis, delta, groundAt) {
  if (!delta) return;
  const field = fields[axis], start = p[field];
  let end = start + delta;
  // A northward sweep can enter the rib row from well outside its footprint.
  const obstacles = axis === 2 ? nearby(boxes,{...p,northM:0}) :
    axis === 1 ? nearby(boxes,{...p,altitudeM:eye}) : nearby(boxes,p);
  for (const box of obstacles) {
    if (!insideAxis(p, box, (axis + 1) % 3) || !insideAxis(p, box, (axis + 2) % 3)) continue;
    const edge = delta > 0 ? box[2 * axis] - margins[axis][0] : box[2 * axis + 1] + margins[axis][1];
    if (delta > 0 && start <= edge + tolerance) end = Math.min(end, edge);
    if (delta < 0 && start >= edge - tolerance) end = Math.max(end, edge);
  }
  p[field] = axis === 1 ? Math.max(groundAt(p.eastM,p.northM)+eye, Math.min(1500000, end)) : end;
}
export function supportAt(boxes, p, groundAt=flatGround) {
  let top = groundAt(p.eastM,p.northM);
  for (const box of nearby(boxes,{...p,altitudeM:eye})) {
    if (insideAxis(p, box, 0) && insideAxis(p, box, 2) && box[3] <= p.altitudeM - eye + tolerance)
      top = Math.max(top, box[3]);
  }
  return top + eye;
}
export function moveBody(p, boxes, dx, dy, dz, groundAt=flatGround) {
  if (!dx && !dy && !dz) return;
  const axes=Number(!!dx)+Number(!!dz)+Number(!!dy);
  const steps=axes>1 ? Math.min(64,Math.max(1,Math.ceil(Math.hypot(dx,dy,dz)/.25))) : 1;
  for(let i=0;i<steps;i++){
    sweep(p, boxes, 0, dx/steps,groundAt);
    sweep(p, boxes, 2, dz/steps,groundAt);
    sweep(p, boxes, 1, dy/steps,groundAt);
  }
  p.altitudeM=Math.max(p.altitudeM,groundAt(p.eastM,p.northM)+eye);
  if (p.mode === 'walk') {
    const support=supportAt(boxes,p,groundAt);
    if(p.altitudeM-support<=.4)p.altitudeM=support;
    else p.mode='flight';
  }
}

// Earlier saves can be inside an extension of the old finite mesh. Recover
// to the closest open face at the saved location, including the rooftop.
export function resolvePose(p, boxes, groundAt=flatGround) {
  p.altitudeM = Math.max(groundAt(p.eastM,p.northM)+eye,p.altitudeM);
  if (solidAt(boxes, p.eastM, p.altitudeM, p.northM,groundAt)) {
    const choices = [];
    for (const box of nearby(boxes,p)) {
      for (let axis = 0; axis < 3; axis++) {
        const edges = [box[2*axis] - margins[axis][0], box[2*axis+1] + margins[axis][1]];
        for (const value of edges) {
          if (!Number.isFinite(value)) continue;
          const candidate = {...p, [fields[axis]]:value};
          if (!solidAt(boxes, candidate.eastM, candidate.altitudeM, candidate.northM,groundAt))
            choices.push({candidate, distance:Math.abs(value-p[fields[axis]])});
        }
      }
    }
    choices.sort((a,b) => a.distance-b.distance);
    if (choices.length) Object.assign(p, choices[0].candidate);
  }
  if (p.mode === 'walk') p.altitudeM = supportAt(boxes, p,groundAt);
  return p;
}
