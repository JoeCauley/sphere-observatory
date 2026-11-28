export const packId = 'infinite-new-york';
export const version = '0.1.0';
export const room = Object.freeze({block: 'orchard-01', building: '27', apartment: '1A', slot: 'dining-chair'});
// Metres from the rear-left corner of the finished floor. +z faces Orchard Street.
// Yaw is measured from -z towards +x, as in the host's geographic camera.
export const origin = Object.freeze({x: -4, y: 0.66, z: -7});
export const placements = Object.freeze({
  A: Object.freeze({x: 3.58, y: 0, z: 3.50, yaw: Math.PI / 2}),
  B: Object.freeze({x: 6.35, y: 0, z: 5.97, yaw: Math.PI})
});
export const sidewalk = Object.freeze({eastM: -1.55, northM: 4.95, altitudeM: 1.79, yaw: 0, pitch: 0.085, mode: 'walk'});
export function objectId(world, instance, address = room) {
  return [world, instance, address.block, address.building, address.apartment, address.slot].map(encodeURIComponent).join('/');
}
export function chairPosition(target) {
  const p = placements[target];
  return {x: origin.x + p.x, y: origin.y + p.y, z: origin.z + p.z, yaw: p.yaw};
}
