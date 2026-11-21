// The installed Outfall uses metres measured from the near service facade.
export const halfLengthM=19999000;
export const roofM=1400, tunnelStartM=43, widthM=1000000, farEdgeM=tunnelStartM+widthM;
export const rampEastM=250, rampHalfM=6, rampRunM=14000, rampLandingM=1;

export function rampAt(east,north){
  if(Math.abs(east-rampEastM)>rampHalfM)return 0;
  const outside=north<0?-north:north-farEdgeM;
  if(outside<0 || outside>rampRunM)return 0;
  return roofM*Math.min(1,(rampRunM-outside)/(rampRunM-rampLandingM));
}

// Entry and release overlap so a stationary or restored camera never bounces.
export function onBorder(p,halfWidth,margin=2400){
  const access=Math.abs(p.eastM-rampEastM)<=rampHalfM+20?rampRunM:0;
  return Math.abs(p.eastM)<Math.min(halfLengthM,halfWidth) &&
    p.northM>=-margin-access && p.northM<=farEdgeM+margin+access;
}
