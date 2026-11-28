// Coordinates are station metres: x along the freight line, z across it,
// y above the slab. The kit is fitted to the surveyed roof, including old records.
export const bayStart = 3900, bayEnd = 11900, bayHalf = 1520;
export const quayZ = -405;
export const portals = [4900, 8000, 10900];
const cached = new Map();

export function inFreightOpening(x, z, halfX = 0, halfZ = 0) {
  return x - halfX > bayStart && x + halfX < bayEnd && Math.abs(z) + halfZ < bayHalf;
}

const foundation = [.32,.37,.36], blueSteel = [.22,.34,.37], oxide = [.77,.32,.13];
const enamel = [.84,.67,.42], dark = [.13,.19,.21], lamp = [1,.84,.55];

export function freightBay(roofM) {
  if (cached.has(roofM)) return cached.get(roofM);
  const parts = [];
  // A member is a box or a parallelepiped inclined across the lane.
  function member(x0,x1,y0,y1,z0,z1,color,rise=0) {
    parts.push({x0,x1,y0,y1,z0,z1,color,rise});
  }
  for (const [index,x] of portals.entries()) {
    const crown = roofM + [590,1150,680][index];
    const pier = 1150, span = 1360;
    for (const sign of [-1,1]) {
      const z = sign*pier;
      member(x-142,x+142,0,92,z-117,z+117,foundation);
      for (const dx of [-78,78]) {
        member(x+dx-29,x+dx+29,92,crown+30,z-56,z+56,blueSteel);
        member(x+dx-34,x+dx+34,crown-390,crown-324,z-63,z+63,enamel);
      }
      // The collar wraps both columns. Its exposed faces sit proud on all four sides.
      for (let y=320; y<crown-235; y+=370)
        member(x-110,x+110,y,y+37,z-62,z+62,oxide);
      // The stepped haunch transfers the bridge load into the two columns.
      const lo = Math.min(sign*680,z), hi = Math.max(sign*680,z);
      member(x-85,x+85,crown-(sign>0?75:435),crown-(sign>0?10:370),lo,hi,oxide,-sign*360);
    }
    for (const dx of [-84,84]) {
      member(x+dx-18,x+dx+18,crown-62,crown,-span,span,oxide);
      member(x+dx-18,x+dx+18,crown+147,crown+190,-span,span,oxide);
      for (let i=0;i<10;i++) {
        const z=-span+i*span/5, base=crown+(i%2?145:-35);
        member(x+dx-12,x+dx+12,base,base+33,z,z+span/5,blueSteel,i%2?-180:180);
      }
    }
    // Offset counterhouse, winch and hanging spreader give the high portal a handed silhouette.
    const hookZ = [245,-95,300][index];
    member(x-116,x+116,crown+12,crown+132,-span-128,-span+169,dark);
    member(x-126,x+126,crown+129,crown+164,-span-143,-span+180,enamel);
    member(x-92,x+92,crown-84,crown+74,hookZ-121,hookZ+121,oxide);
    for (const dx of [-61,61]) for (const dz of [-73,73])
      member(x+dx-3.5,x+dx+3.5,813,crown-64,hookZ+dz-3.5,hookZ+dz+3.5,dark);
    member(x-86,x+86,775,815,hookZ-113,hookZ+113,enamel);
    member(x-99,x+99,crown+186,crown+202,-span,-span+84,lamp);
  }
  // Human-scale quay fixtures. Leave the walking line and the rail clearance free.
  for (let x=bayStart+50;x<bayEnd;x+=52) {
    member(x-.28,x+.28,0,1.12,quayZ-.33,quayZ+.33,oxide);
    member(x-.33,x+.33,1.12,1.28,quayZ-.36,quayZ+.36,enamel);
  }
  for (let x=bayStart+150;x<bayEnd;x+=260) {
    member(x-.38,x+.38,0,7.6,quayZ-23.35,quayZ-22.65,blueSteel);
    member(x-.55,x+.55,7.25,7.72,quayZ-23.4,quayZ-18.4,oxide);
    member(x-.48,x+.48,7.22,7.41,quayZ-20.5,quayZ-18.35,lamp);
    // A service cabinet, plinth and lit annunciator at the base of each inspection lamp.
    member(x+2.5,x+5.8,0,.22,quayZ-24.3,quayZ-21.7,foundation);
    member(x+2.8,x+5.5,.22,2.3,quayZ-24.,quayZ-22.,blueSteel);
    member(x+2.68,x+5.62,2.3,2.52,quayZ-24.15,quayZ-21.85,oxide);
    member(x+3.12,x+4.78,1.43,1.62,quayZ-24.04,quayZ-23.99,lamp);
  }
  cached.set(roofM,parts);
  return parts;
}

// Clip the swept body against the actual inclined member. A pilot can fly
// through the open truss cells and an old save inside a new member can leave it.
function hits(part, x,y,z, dx,dy,dz, hw,height,hl) {
  let enter=0, exit=1, alreadyInside=true;
  function clip(origin,delta,low,high) {
    alreadyInside &&= origin>low && origin<high;
    if (!delta) return origin>low && origin<high;
    const a=(low-origin)/delta, b=(high-origin)/delta;
    enter=Math.max(enter,Math.min(a,b)); exit=Math.min(exit,Math.max(a,b));
    return enter<exit;
  }
  const slope=part.rise/(part.z1-part.z0), extra=Math.abs(slope)*hl;
  return clip(x,dx,part.x0-hw,part.x1+hw) && clip(z,dz,part.z0-hl,part.z1+hl)
    && clip(y,dy,part.y0+Math.min(0,part.rise)-height,part.y1+Math.max(0,part.rise))
    && clip(y-slope*(z-part.z0),dy-slope*dz,part.y0-extra-height,part.y1+extra)
    && !alreadyInside;
}

export function freightObstruction(s, from, to, group) {
  const x=from.eastM-s.address.chainageM, z=from.northM, y=from.altitudeM-group.eye;
  const dx=to.eastM-from.eastM, dz=to.northM-z, dy=to.altitudeM-from.altitudeM;
  const [w,h,l]=group.body, hw=w/2, hl=l/2;
  if (Math.max(x,x+dx)+hw<bayStart || Math.min(x,x+dx)-hw>bayEnd ||
      Math.max(z,z+dz)+hl<-bayHalf || Math.min(z,z+dz)-hl>bayHalf ||
      Math.min(y,y+dy)>s.roofM+1352) return false;
  return freightBay(s.roofM).some(part=>hits(part,x,y,z,dx,dy,dz,hw,h,hl));
}
