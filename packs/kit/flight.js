/* Kit: scripted flight.
 *
 * Optional. The pacing a contract biome uses when the Observatory flies into or out of it, so
 * that every biome crosses its Duck Blind the same way without each carrying its own copy.
 * Heights are in metres above the biome's own ground. A shape is a function of t (0 to 1) that
 * returns { pos, alt }: how far the view (place, heading, tilt) has moved, and how far the
 * height has moved, each 0 to 1. Height is always interpolated by ratio (see heightAt).
 *
 * Canon for the crossing: a few seconds in obscuring cloud, then a fast fall away of concealment
 * with the ground first discernible below. blind is { baseM, topM, edgeM }.
 */
const smooth = u => u * u * (3 - 2 * u);

// Lift-off into the blind: rise beneath the ordinary sky, then the last fifth of the time
// climbing as the cloud gathers. Null if toM is not inside the blind or the eye is already above its edge.
export function ascentShape(fromM, toM, blind) {
  if(!blind)return null;
  const edge = blind.baseM - blind.edgeM;
  if (!(toM > edge && toM <= blind.topM)) return null;
  const span = Math.log(toM / fromM), f1 = Math.log(edge / fromM) / span;
  if (!(f1 > 0)) return null;
  const rise = u => .1 * u + .9 * smooth(u);
  return t => ({ pos: smooth(t), alt: t < .8 ? f1 * rise(t / .8) : f1 + (1 - f1) * (t - .8) / .2 });
}

// Arrival out of the blind: a tenth of the time descending in cloud, a tenth while the
// concealment falls away (view held straight down), then the descent and the turn to the approach.
export function arrivalShape(fromM, toM, blind) {
  if(!blind)return null;
  const span = Math.log(fromM / toM), f1 = Math.log(fromM / blind.baseM) / span, f2 = Math.log(fromM / (blind.baseM - blind.edgeM)) / span;
  if (!(f1 > 0)) return null;
  const fall = u => .15 * u + .85 * smooth(u);
  return t => t < .1 ? { pos: 0, alt: f1 * t / .1 } : t < .2 ? { pos: 0, alt: f1 + (f2 - f1) * (t - .1) / .1 } : { pos: fall((t - .2) / .8), alt: f2 + (1 - f2) * fall((t - .2) / .8) };
}

// One step of a script { t, seconds, shape?, ease? }: advances its clock and says where it is.
export function advance(script, dt) {
  const t = Math.min(1, (script.t += dt) / script.seconds), shaped = script.shape ? script.shape(t) : null, pos = shaped ? shaped.pos : script.ease ? script.ease(t) : smooth(t);
  return { pos, alt: shaped ? shaped.alt : pos, done: t >= 1 };
}

// Height part-way between two heights, by ratio: equal times cover equal ratios of height.
export const heightAt = (fromM, toM, f) => Math.exp(Math.log(fromM) + (Math.log(toM) - Math.log(fromM)) * f);
