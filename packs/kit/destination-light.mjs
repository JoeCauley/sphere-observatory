// One lighting calculation for a destination at a Sphere time. The doorway picture and the
// walkable scene call it with the same inputs, so a facade has the same light on both sides
// of a threshold.
//
// Inside the shell the star stands at the zenith everywhere. Time of day is not a sun angle:
// it is how much of the star the Shades let through (direct, 0..1, the host's
// SphereCollection.visibility via SphereStageFrame.surfaceLight) plus the shellshine reflected
// from the lit shell overhead. "Dusk" is a Shade edge crossing; "night" is full occlusion.
export const REFERENCE_LIGHT=Object.freeze({name:'reference',direct:1,sun:[.46,.78,.42],light:[.34,.66,0,1],skyLo:[.86,.72,.60],skyHi:[.36,.52,.70]});
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function destinationLight(direct=1,shellshine=.22){
  const d=Math.max(0,Math.min(1,Number.isFinite(direct)?direct:1)),s=Math.max(0,Number.isFinite(shellshine)?shellshine:.22);
  const ambient=.08+.30*s+.18*d;   // shell-lit fill plus starlight scattered in the cavity air
  return {name:'sphere',direct:d,shellshine:s,sun:[0,1,0],light:[ambient,.62*d,0,d],
    skyLo:mix([.10,.11,.14],[.86,.72,.60],d),skyHi:mix([.16,.18,.24],[.36,.52,.70],d)};
}
// The host decides which profile a trial uses; packs ask with the same inputs.
export function lightFor(settings,direct,shellshine){
  return settings?.light==='sphere'?destinationLight(direct,shellshine):REFERENCE_LIGHT;
}
