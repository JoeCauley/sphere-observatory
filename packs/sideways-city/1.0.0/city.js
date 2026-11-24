/* The Sideways City: an endless city built for people fifty feet across.
 *
 * Self-contained. Its own renderer, world, movement and save; it imports nothing
 * from any other pack. It implements the Sphere biome contract, version 1:
 *
 *   window.SphereBiome = {
 *     contract: 'sphere-biome/1', id, version,
 *     ready      Promise, resolves when the first frame has been drawn
 *     arrived    Promise, resolves when a from-the-air arrival has finished
 *     pose()     { eastM, northM, altitudeM, yaw, pitch, mode }
 *     ascend(o)  scripted lift-off; resolves 'revealed' or 'taken-over'. It never
 *                moves the saved place. o.toAltitudeM asks for a greater height and
 *                o.handoff for a straight-down view there, so the host can exchange
 *                the picture with its own at the same height.
 *     begin()    start a held arrival (see below); returns `arrived`
 *     save()     write the current place now
 *     dispose()  stop, save, release GPU resources
 *   }
 *   Arrival is chosen by the address: ?arrival=saved (default) | ground | air.
 *   With air, &fromM=<metres> (or fromM=blind, the middle of its own Duck Blind) starts the approach straight down from that height
 *   and &hold=1 waits, unseen and ready, until the host calls begin().
 *   An element with id "leavePack" asks to leave. pagehide saves and disposes.
 *
 * Everything is derived from the body it was built for: a crab about 15 m across
 * that walks sideways and does not climb stairs. Doors are far wider than tall.
 * Streets are 60 m. Every curb is 1.5 m, a comfortable step for them and a wall
 * for you; the ramps they use to mount a block are the only way you get up.
 */
import { ascentShape, arrivalShape, advance, heightAt } from '../../kit/flight.js';   // shared pacing; the kit is not a pack
const ID = 'sideways-city', VERSION = '1.0.0', SAVE_KEY = 'sphere-biome:' + ID + ':' + VERSION;
import {CELL, PLINTH, CURB, EYE, RAMP, RAMP_HALF, hash, cell, local, index, ground, solid} from './ground.js';
const RADIUS=8;
const REVEAL_M = 3000, MESH_BELOW_M = 600;
// The air, declared rather than built in, so that biomes can differ: thin, thick, layered.
// haze: level layers of air, each with a base, a top and how much it dims per kilometre of path.
// blind: the Duck Blind band. Canon: seen from above, the ground below is discernible; crossing
// it is a few seconds of obscuring cloud. So it veils the eye only while the eye is inside it.
// Every height here is PROPOSED for this prototype; no kilometre value is canon.
const AIRS = {
  thin: { profile:'city-thin', haze: [{ baseM: 0, topM: 400, perKm: .5 }, { baseM: 0, topM: 4000, perKm: .08 }], blind: null },
  thick: { profile:'city-smog', haze: [{ baseM: 0, topM: 1500, perKm: .9 }, { baseM: 0, topM: 9000, perKm: .25 }], blind: { baseM: 11000, topM: 13000, edgeM: 1200 } }
};
const AIR = AIRS[new URLSearchParams(location.search).get('air')] ?? AIRS.thin;
const HAZE = new Float32Array(AIR.haze.flatMap(l => [l.baseM, l.topM, l.perKm / 1000, 0]));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const veilAt = m => !AIR.blind?0:smooth(AIR.blind.baseM - AIR.blind.edgeM, AIR.blind.baseM, m) * (1 - smooth(AIR.blind.topM, AIR.blind.topM + AIR.blind.edgeM, m));
const FAR_ONLY = new URLSearchParams(location.search).get('far') === '1';   // test aid: trace everything, to compare with the meshes
const $ = id => document.getElementById(id);
const canvas = $('world');

/* ---- geometry for one cell: position, colour, normal ---- */
function build(ix, iz) {
  const c = cell(ix, iz), out = [];
  const tri = (a, b, d, col) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]; let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n) || 1; n = n.map(q => q / l); for (const p of [a, b, d]) out.push(p[0], p[1], p[2], col[0], col[1], col[2], n[0], n[1], n[2]); };
  const quad = (a, b, d, e, col) => { tri(a, b, d, col); tri(a, d, e, col); };
  const box = (x0, y0, z0, x1, y1, z1, col, top = col) => {
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], col); quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], col);
    quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], col); quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], col);
    if (top) quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], top);
  };
  const dark = [.06, .05, .06], water = [.10, .36, .40], shade = c.stone.map(v => v * .86);
  if (c.kind !== 'plaza') {
    box(-PLINTH, 0, -PLINTH, PLINTH, CURB, PLINTH, shade, c.kind === 'pool' ? null : c.stone);
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {   // the ramps: their way up, and yours
      const p = (along, out2, y) => sx ? [sx * out2, y, along] : [along, y, sz * out2];
      quad(p(-RAMP_HALF, PLINTH, CURB), p(RAMP_HALF, PLINTH, CURB), p(RAMP_HALF, PLINTH + RAMP, 0), p(-RAMP_HALF, PLINTH + RAMP, 0), c.stone.map(v => v * .94));
      tri(p(-RAMP_HALF, PLINTH, CURB), p(-RAMP_HALF, PLINTH + RAMP, 0), p(-RAMP_HALF, PLINTH, 0), shade); tri(p(RAMP_HALF, PLINTH, CURB), p(RAMP_HALF, PLINTH, 0), p(RAMP_HALF, PLINTH + RAMP, 0), shade);
    }
  }
  if (c.kind === 'pool') {   // one level top, nothing stacked: a stone rim around a water panel (stacked sheets flicker when seen from low down)
    const P = PLINTH, I = PLINTH - 6, top = (x0, z0, x1, z1, col) => quad([x0, CURB, z0], [x1, CURB, z0], [x1, CURB, z1], [x0, CURB, z1], col);
    top(-P, -P, P, -I, shade); top(-P, I, P, P, shade); top(-P, -I, -I, I, shade); top(I, -I, P, I, shade); top(-I, -I, I, I, water);
  }
  if (c.kind === 'plaza') {   // resting rails: a bar at shell height on two posts
    for (let i = -1; i <= 1; i++) { const x = i * 46; box(x - 14, 0, -1.2, x - 12, 7, 1.2, shade); box(x + 12, 0, -1.2, x + 14, 7, 1.2, shade); box(x - 15, 7, -1.6, x + 15, 8.2, 1.6, c.roof); }
    box(-4, 0, 34, 4, 22, 42, c.stone, c.roof);
  }
  for (const b of c.boxes) {
    if (b.prop) continue;   // drawn with the plaza above; listed only so it is solid
    if (b.tower) {
      const n = 12, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, r = b.tower, top = CURB + b.h;
      for (let i = 0; i < n; i++) { const a = i * 2 * Math.PI / n, a2 = (i + 1) * 2 * Math.PI / n, p = [cx + r * Math.cos(a), cz + r * Math.sin(a)], q = [cx + r * Math.cos(a2), cz + r * Math.sin(a2)];
        quad([p[0], CURB, p[1]], [q[0], CURB, q[1]], [q[0], top, q[1]], [p[0], top, p[1]], i % 2 ? c.stone : shade); tri([p[0], top, p[1]], [q[0], top, q[1]], [cx, top + r * .5, cz], c.roof); }
      continue;
    }
    let { x0, x1, z0, z1 } = b, y = CURB;
    for (let t = 0; t < b.tiers; t++) { const h = b.h / (t + 1); box(x0, y, z0, x1, y + h, z1, t % 2 ? shade : c.stone, c.roof); if (t === 0) {
        // Doors: wider than tall, because they walk in sideways.
        const dw = Math.min(11, (x1 - x0) / 2 - 3), dh = Math.min(9, h - 2), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, dz = Math.min(11, (z1 - z0) / 2 - 3);
        quad([mx - dw, y, z0 - .08], [mx + dw, y, z0 - .08], [mx + dw, y + dh, z0 - .08], [mx - dw, y + dh, z0 - .08], dark); quad([mx + dw, y, z1 + .08], [mx - dw, y, z1 + .08], [mx - dw, y + dh, z1 + .08], [mx + dw, y + dh, z1 + .08], dark);
        quad([x0 - .08, y, mz + dz], [x0 - .08, y, mz - dz], [x0 - .08, y + dh, mz - dz], [x0 - .08, y + dh, mz + dz], dark); quad([x1 + .08, y, mz - dz], [x1 + .08, y, mz + dz], [x1 + .08, y + dh, mz + dz], [x1 + .08, y + dh, mz - dz], dark);
      }
      y += h; const inset = Math.min(x1 - x0, z1 - z0) * .16; x0 += inset; x1 -= inset; z0 += inset; z1 -= inset; }
  }
  return new Float32Array(out);
}

/* ---- renderer ---- */
const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
function program(vs, fs) {
  const make = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram(); gl.attachShader(p, make(gl.VERTEX_SHADER, vs)); gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
  const u = {}; for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
const COMMON = `uniform vec3 uRight,uUp,uForward;uniform float uAspect,uAltitude;
const vec3 SUN=vec3(.46,.78,.42);
vec3 sky(vec3 d){float t=clamp(d.y*.5+.5,0.,1.);vec3 c=mix(vec3(.86,.72,.60),vec3(.36,.52,.70),smoothstep(.45,.95,t));return c+vec3(1.,.85,.6)*pow(max(dot(normalize(d),SUN),0.),90.)*.5;}
uniform vec4 uHaze[2];uniform vec3 uBlind;uniform float uTime;
float through(vec4 L,float dy,float t){float y=uAltitude,y1=y+dy*t,lo=min(y,y1),hi=max(y,y1);   // length of the ray inside one level layer
 return hi-lo<1e-3?(y>=L.x&&y<=L.y?t:0.):t*max(0.,min(hi,L.y)-max(lo,L.x))/(hi-lo);}
float fogOf(float dist,float dy){float tau=0.;for(int i=0;i<2;i++)tau+=uHaze[i].z*through(uHaze[i],dy,dist);return 1.-exp(-tau);}
vec3 veiled(vec3 col,vec3 d){if(uBlind.z<=0.)return col;float v=smoothstep(uBlind.x-uBlind.z,uBlind.x,uAltitude)*(1.-smoothstep(uBlind.y,uBlind.y+uBlind.z,uAltitude));if(v<=0.)return col;
 vec3 q=d*3.+vec3(uTime*.05,uAltitude*.004,uTime*.03);float n=.5+.5*sin(q.x*2.1+sin(q.z*1.7+q.y))*sin(q.y*1.3+q.z*2.3);   // wisps that stream past as the eye climbs
 return mix(col,mix(vec3(.80,.78,.76),vec3(.95,.93,.90),n),smoothstep(0.,1.,v*1.5-.5*n));}`;
const mesh = program(`#version 300 es
precision highp float;layout(location=0)in vec3 aPos;layout(location=1)in vec3 aCol;layout(location=2)in vec3 aNor;
uniform vec3 uOffset;${COMMON}
out vec3 vCol,vNor,vRel;
void main(){vec3 p=aPos+uOffset;float z=dot(p,uForward);gl_Position=vec4(dot(p,uRight)*1.19/uAspect,dot(p,uUp)*1.19,z-.2,z);vCol=aCol;vNor=aNor;vRel=p;}`,
`#version 300 es
precision highp float;in vec3 vCol,vNor,vRel;out vec4 frag;uniform float uFade;${COMMON}
void main(){float dist=length(vRel);vec3 n=normalize(vNor);if(dot(n,vRel)>0.)n=-n;float lit=.34+.66*max(dot(n,SUN),0.)+.10*max(n.y,0.);
 vec3 col=veiled(mix(vCol*lit,sky(vRel/dist*vec3(1.,.15,1.)),fogOf(dist,vRel.y/dist)),vRel/dist);
 gl_FragDepth=clamp(log2(1.+dist)/log2(1.+400000.),0.,1.);frag=vec4(pow(col,vec3(1./2.2)),uFade);}`);
// The far field. Not a painting of the city: the city itself, traced per pixel from the
// same function that builds the meshes (same hash, same plinths, tiers, doors, towers).
// A ray is stepped through the street grid; each cell it crosses is rebuilt and intersected.
// Because near and far are one function there is nowhere for a building to pop in. Where a
// building would be smaller than a pixel it fades into the average of its block.
const plane = program(`#version 300 es
precision highp float;${COMMON}
out vec2 vNdc;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))*2.-1.;vNdc=p;gl_Position=vec4(p,0.,1.);}`,
`#version 300 es
precision highp float;precision highp int;in vec2 vNdc;out vec4 frag;
uniform ivec2 uCell;uniform vec2 uLocal;uniform int uMesh;uniform float uPix;${COMMON}
const float CELL=${CELL}.,PL=${PLINTH}.,CURB=${CURB},HMAX=262.;
const vec3 STONE[4]=vec3[4](vec3(.78,.62,.52),vec3(.72,.56,.50),vec3(.80,.70,.58),vec3(.66,.58,.55));
const vec3 ROOF[3]=vec3[3](vec3(.34,.52,.50),vec3(.42,.36,.44),vec3(.55,.40,.30));
const vec3 DARK=vec3(.06,.05,.06),WATER=vec3(.10,.36,.40),STREET=vec3(.50,.44,.40),FLAT=vec3(.70,.57,.50),MEAN=vec3(.65,.56,.50);
float hsh(ivec2 c,int k){uint h=uint(c.x)*374761393u^uint(c.y)*668265263u^uint(k)*2246822519u;h=(h^(h>>13u))*1274126177u;h^=h>>16u;return min(float(h)/4294967296.,.9999999);}
float bt;vec3 bn,bc;   // nearest hit so far: distance, normal, colour
void tryBox(vec3 o,vec3 d,vec3 inv,vec3 lo,vec3 hi,vec3 side,vec3 top){
 vec3 a=(lo-o)*inv,b=(hi-o)*inv,t0=min(a,b),t1=max(a,b);float tn=max(max(t0.x,t0.y),t0.z),tf=min(min(t1.x,t1.y),t1.z);
 if(tn>tf||tn<0.||tn>=bt)return;
 bt=tn;if(tn==t0.y){bn=vec3(0.,-sign(d.y),0.);bc=d.y<0.?top:side;}else if(tn==t0.x){bn=vec3(-sign(d.x),0.,0.);bc=side;}else{bn=vec3(0.,0.,-sign(d.z));bc=side;}
}
void cellHit(ivec2 ij,vec3 o,vec3 d,vec3 inv){   // o is measured from this cell's centre
 ivec2 c=uCell+ij;float k=hsh(c,1);
 vec3 stone=STONE[int(hsh(c,13)*4.)],roof=ROOF[int(hsh(c,14)*3.)],shade=stone*.86;
 if(k>=.10&&k<.19){   // plaza: resting rails and a marker
  for(int i=-1;i<=1;i++){float x=float(i)*46.;tryBox(o,d,inv,vec3(x-14.,0.,-1.2),vec3(x-12.,7.,1.2),shade,shade);tryBox(o,d,inv,vec3(x+12.,0.,-1.2),vec3(x+14.,7.,1.2),shade,shade);tryBox(o,d,inv,vec3(x-15.,7.,-1.6),vec3(x+15.,8.2,1.6),roof,roof);}
  tryBox(o,d,inv,vec3(-4.,0.,34.),vec3(4.,22.,42.),stone,roof);return;}
 bool pool=k<.10;float was=bt;
 tryBox(o,d,inv,vec3(-PL,0.,-PL),vec3(PL,CURB,PL),shade,pool?shade:stone);
 if(pool&&bt<was&&bn.y>.5){vec3 p=o+d*bt;if(abs(p.x)<PL-6.&&abs(p.z)<PL-6.)bc=WATER;}
 for(int m=0;m<4;m++){   // the four ramps
  float sg=m<2?1.:-1.;bool ax=(m&1)==0;float ou=ax?o.x:o.z,du=ax?d.x:d.z,ov=ax?o.z:o.x,dv=ax?d.z:d.x,den=d.y+sg*CURB*du/9.;
  if(abs(den)<1e-9)continue;float t=(CURB*(PL+9.-sg*ou)/9.-o.y)/den;if(t<=0.||t>=bt)continue;
  float u=sg*(ou+du*t),v=ov+dv*t;if(u<PL||u>PL+9.||abs(v)>10.)continue;
  bt=t;bn=normalize(ax?vec3(sg*CURB/9.,1.,0.):vec3(0.,1.,sg*CURB/9.));bc=stone*.94;}
 if(pool)return;
 float w=34.+hsh(c,2)*24.,dd=26.+hsh(c,3)*30.,h=14.+hsh(c,4)*16.;
 float cx=(hsh(c,5)-.5)*(PL-w)*1.2,cz=(hsh(c,6)-.5)*(PL-dd)*1.2;int tiers=1+int(hsh(c,7)*3.);
 float x0=cx-w,x1=cx+w,z0=cz-dd,z1=cz+dd,y=CURB;
 for(int t=0;t<3;t++){if(t>=tiers)break;float th=h/float(t+1);was=bt;
  tryBox(o,d,inv,vec3(x0,y,z0),vec3(x1,y+th,z1),t==1?shade:stone,roof);
  if(t==0&&bt<was&&bn.y==0.){vec3 p=o+d*bt;   // doors: wider than tall
   if(p.y-y<min(9.,th-2.)){if(bn.z!=0.){if(abs(p.x-(x0+x1)*.5)<min(11.,(x1-x0)*.5-3.))bc=DARK;}else if(abs(p.z-(z0+z1)*.5)<min(11.,(z1-z0)*.5-3.))bc=DARK;}}
  y+=th;float inset=min(x1-x0,z1-z0)*.16;x0+=inset;x1-=inset;z0+=inset;z1-=inset;}
 if(hsh(c,8)<.22){   // tower: a shaft and a cap
  float r=13.+hsh(c,9)*7.,tx=(hsh(c,10)<.5?-1.:1.)*(PL-r-3.),tz=(hsh(c,11)<.5?-1.:1.)*(PL-r-3.),top=CURB+80.+hsh(c,12)*90.;
  vec2 q=o.xz-vec2(tx,tz);float a=dot(d.xz,d.xz),b=dot(q,d.xz),disc=b*b-a*(dot(q,q)-r*r);
  if(disc>0.){float t=(-b-sqrt(disc))/a,py=o.y+d.y*t;if(t>0.&&t<bt&&py>=CURB&&py<=top){vec2 p=q+d.xz*t;float ang=atan(p.y,p.x);if(ang<0.)ang+=6.2831853;float i=floor(ang/.5235988),mid=(i+.5)*.5235988;bt=t;bn=vec3(cos(mid),0.,sin(mid));bc=mod(i,2.)>.5?stone:shade;}}
  vec3 qa=o-vec3(tx,top+r*.5,tz);float ca=a-4.*d.y*d.y,cb=dot(qa.xz,d.xz)-4.*qa.y*d.y,cd=cb*cb-ca*(dot(qa.xz,qa.xz)-4.*qa.y*qa.y);
  if(cd>0.&&abs(ca)>1e-9){float sq=sqrt(cd);for(int m=0;m<2;m++){float t=(-cb+(m==0?-sq:sq))/ca,yy=qa.y+d.y*t;if(t>0.&&t<bt&&yy<=0.&&yy>=-r*.5){vec3 p=qa+d*t;bt=t;bn=normalize(vec3(p.x,-4.*p.y,p.z));bc=roof;}}}
 }
}
void main(){vec3 d=normalize(uForward+uRight*vNdc.x*uAspect/1.19+uUp*vNdc.y/1.19);
 if(abs(d.x)<1e-6)d.x=1e-6;if(abs(d.z)<1e-6)d.z=1e-6;if(abs(d.y)<1e-6)d.y=-1e-6;
 vec3 inv=1./d,o=vec3(uLocal.x,uAltitude,uLocal.y);
 float tG=d.y<0.?uAltitude/-d.y:1e12;                                  // where the ray meets the street
 float tIn=o.y>HMAX?(d.y<0.?(o.y-HMAX)/-d.y:1e12):0.;                  // where it enters the layer that holds buildings
 float tOut=d.y>0.?(o.y<HMAX?(HMAX-o.y)/d.y:0.):tG,tLim=30./uPix;      // beyond tLim a pixel is wider than a block
 bt=1e12;
 if(tIn<tOut&&tIn<tLim){
  vec3 p=o+d*tIn;vec2 cf=floor((p.xz+100.)/CELL),stp=sign(d.xz);ivec2 ij=ivec2(cf),si=ivec2(stp);
  vec2 tMax=((cf+max(stp,0.))*CELL-100.-o.xz)*inv.xz,tDelta=CELL*abs(inv.xz);
  for(int n=0;n<96;n++){
   if(max(abs(ij.x),abs(ij.y))>uMesh){cellHit(ij,o-vec3(float(ij.x)*CELL,0.,float(ij.y)*CELL),d,inv);if(bt<1e11)break;}
   float tNext=min(tMax.x,tMax.y);if(tNext>tOut||tNext>tLim)break;
   if(tMax.x<tMax.y){tMax.x+=tDelta.x;ij.x+=si.x;}else{tMax.y+=tDelta.y;ij.y+=si.y;}
  }
 }
 if(bt>1e11&&d.y>-.0005){frag=vec4(pow(veiled(sky(d),d),vec3(1./2.2)),1.);gl_FragDepth=1.;return;}
 float up1=.34+.66*SUN.y+.10,t=bt<1e11?bt:tG;vec3 col;
 if(bt<1e11)col=bc*(.34+.66*max(dot(bn,SUN),0.)+.10*max(bn.y,0.));
 else{vec2 g=d.xz*tG+uLocal,l=abs(fract(g/CELL+.5)-.5)*CELL;float k=hsh(uCell+ivec2(floor(g/CELL+.5)),1);col=(k>=.10&&k<.19&&max(l.x,l.y)<PL?FLAT:STREET)*up1;}
 if(d.y<0.){   // too small to draw honestly: become the average of the block
  vec2 g=d.xz*tG+uLocal,l=abs(fract(g/CELL+.5)-.5)*CELL;float width=tG*uPix+.5,block=1.-smoothstep(PL-width,PL+width,max(l.x,l.y));
  col=mix(col,mix(STREET,MEAN,block)*up1,smoothstep(6.,30.,t*uPix));}
 col=veiled(mix(col,sky(d*vec3(1.,.15,1.)),fogOf(t,d.y)),d);
 gl_FragDepth=clamp(log2(1.+t)/log2(1.+400000.),0.,1.);frag=vec4(pow(col,vec3(1./2.2)),1.);}`);
const buffers = new Map();
function buffer(ix, iz) {
  const key = ix + ',' + iz; let b = buffers.get(key);
  if (!b) { const data = build(ix, iz), vao = gl.createVertexArray(), vbo = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    for (const [loc, off] of [[0, 0], [1, 12], [2, 24]]) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 36, off); }
    b = { vao, vbo, count: data.length / 9 }; buffers.set(key, b);
    if (buffers.size > 900) { const first = buffers.keys().next().value, old = buffers.get(first); gl.deleteBuffer(old.vbo); gl.deleteVertexArray(old.vao); buffers.delete(first); } }
  return b;
}
const blank = gl.createVertexArray();

/* ---- state, save ---- */
const start = () => ({ eastM: 0, northM: -86, altitudeM: EYE, yaw: 0, pitch: 0, mode: 'walk' });
let pose = start(), bookmark = start(), script = null, held = null, disposed = false, frames = 0, built = 0, drawn = 0, meshRing = -1;
const valid = p => p && ['eastM', 'northM', 'altitudeM', 'yaw', 'pitch'].every(k => Number.isFinite(p[k])) && ['walk', 'flight'].includes(p.mode);
const placeStore = window.frameElement?.dataset.worldKey ? parent.SphereBiomeLibrary.saveStorage(window.frameElement.dataset.worldKey) : localStorage;
function load() { try { const s = JSON.parse(placeStore.getItem(SAVE_KEY)); if (s?.schema === 1 && valid(s.pose) && valid(s.bookmark)) { pose = { ...s.pose }; bookmark = { ...s.bookmark }; return true; } } catch {} return false; }
// A scripted ascent or arrival never moves the saved place. While one runs, and after it
// until you take the controls, the place saved is the one you last stood in yourself.
function save() { if(window.frameElement?.surfaceEntry?.active===false)return false;try { placeStore.setItem(SAVE_KEY, JSON.stringify({ schema: 1, pose: script?.keep ?? held ?? pose, bookmark })); return true; } catch { return false; } }
const status = text => { $('status').textContent = text; };

/* ---- movement ---- */
const keys = new Set(); let drag = null, last = 0;
const forward = () => [Math.sin(pose.yaw) * Math.cos(pose.pitch), Math.sin(pose.pitch), Math.cos(pose.yaw) * Math.cos(pose.pitch)];
function interrupt() { held = null; if (script?.interruptible) { const done = script.done; script = null; done('taken-over'); status('You have the controls.'); } }
function lift() { if (pose.mode === 'walk') { pose.mode = 'flight'; pose.altitudeM += 12; status('Flying · W goes where you look · Q down, E up · F lands'); } }
function land() { const g = ground(pose.eastM, pose.northM); if (pose.mode === 'flight' && pose.altitudeM - g < 14 && !solid(pose.eastM, pose.northM, 0)) { pose.mode = 'walk'; pose.altitudeM = g + EYE; pose.pitch = Math.max(-1, Math.min(1, pose.pitch)); status('On foot · WASD walks · Space lifts off'); } else status('Come down close to open ground to land.'); }
function step(dt) {
  if (script) { if (script.held) return; const { pos: e, alt: ea, done: over } = advance(script, dt); for (const k of ['eastM', 'northM', 'yaw', 'pitch']) pose[k] = script.from[k] + (script.to[k] - script.from[k]) * e;
    pose.altitudeM = heightAt(script.from.altitudeM, script.to.altitudeM, ea); pose.mode = 'flight';
    if (over) { const done = script.done; held = script.keep; script = null; done('revealed'); } return; }
  const turn = .95 * dt;
  pose.yaw += (Number(keys.has('ArrowRight') || keys.has('KeyX')) - Number(keys.has('ArrowLeft') || keys.has('KeyZ'))) * turn;
  pose.pitch = Math.max(-1.5, Math.min(1.5, pose.pitch + (Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'))) * turn));
  const fx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), fz = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), fy = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0), fast = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (pose.mode === 'walk') {
    const speed = (fast ? 7 : 3) * dt, dx = (Math.sin(pose.yaw) * fz + Math.cos(pose.yaw) * fx) * speed, dz = (Math.cos(pose.yaw) * fz - Math.sin(pose.yaw) * fx) * speed;
    const here = ground(pose.eastM, pose.northM), attempt = (x, z) => !solid(x, z, here + EYE) && Math.abs(ground(x, z) - here) <= .45;
    if (attempt(pose.eastM + dx, pose.northM)) pose.eastM += dx; if (attempt(pose.eastM, pose.northM + dz)) pose.northM += dz;
    pose.altitudeM = ground(pose.eastM, pose.northM) + EYE;
  } else {
    const g = ground(pose.eastM, pose.northM), clear = Math.max(0, pose.altitudeM - g), speed = (8 + clear * .9) * (fast ? 2 : 1) * dt, f = forward();
    const nx = pose.eastM + (f[0] * fz + Math.cos(pose.yaw) * fx) * speed, nz = pose.northM + (f[2] * fz - Math.sin(pose.yaw) * fx) * speed, ny = Math.max(pose.altitudeM + (f[1] * fz + fy) * speed, ground(nx, nz) + EYE);
    if (!solid(nx, nz, ny)) { pose.eastM = nx; pose.northM = nz; pose.altitudeM = Math.min(ny, 4e6); }
  }
}

/* ---- frame ---- */
let resolveReady; const ready = new Promise(r => { resolveReady = r; });
function draw() {
  const w = Math.max(1, Math.floor(canvas.clientWidth * Math.min(devicePixelRatio, 2))), h = Math.max(1, Math.floor(canvas.clientHeight * Math.min(devicePixelRatio, 2)));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  gl.viewport(0, 0, w, h); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clear(gl.DEPTH_BUFFER_BIT);
  const f = forward(), right = [Math.cos(pose.yaw), 0, -Math.sin(pose.yaw)], up = [-Math.sin(pose.yaw) * Math.sin(pose.pitch), Math.cos(pose.pitch), -Math.cos(pose.yaw) * Math.sin(pose.pitch)];
  const common = pr => { gl.useProgram(pr.p); gl.uniform3fv(pr.u.uRight, right); gl.uniform3fv(pr.u.uUp, up); gl.uniform3fv(pr.u.uForward, f); gl.uniform1f(pr.u.uAspect, w / h); gl.uniform1f(pr.u.uAltitude, pose.altitudeM); gl.uniform4fv(pr.u['uHaze[0]'], HAZE); gl.uniform3f(pr.u.uBlind, AIR.blind?.baseM??0, AIR.blind?.topM??0, AIR.blind?.edgeM??0); gl.uniform1f(pr.u.uTime, performance.now() / 1000); };
  // Near the eye: full meshes, nearest ring first. meshRing is the widest ring that is complete;
  // the ground shader traces everything outside it, so a cell is always drawn exactly once.
  const cx = index(pose.eastM), cz = index(pose.northM); let made = 0; meshRing = -1;
  if (!FAR_ONLY && pose.altitudeM < MESH_BELOW_M) {
    for (let r = 0; r <= RADIUS; r++) {
      let whole = true;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || buffers.has((cx + dx) + ',' + (cz + dz))) continue;
        if (made >= 24) { whole = false; continue; }   // at most 24 new cells a frame
        buffer(cx + dx, cz + dz); made++; built++;
      }
      if (!whole) break;
      meshRing = r;
    }
  } else if (script?.to) {   // above the meshes: build the ones waiting at the end of the approach
    const tx = index(script.to.eastM), tz = index(script.to.northM);
    for (let dz = -RADIUS; dz <= RADIUS && made < 24; dz++) for (let dx = -RADIUS; dx <= RADIUS && made < 24; dx++) if (!buffers.has((tx + dx) + ',' + (tz + dz))) { buffer(tx + dx, tz + dz); made++; built++; }
  }
  common(plane); gl.uniform2i(plane.u.uCell, cx, cz); gl.uniform2f(plane.u.uLocal, local(pose.eastM), local(pose.northM)); gl.uniform1i(plane.u.uMesh, meshRing); gl.uniform1f(plane.u.uPix, 2 / (1.19 * h));
  gl.bindVertexArray(blank); gl.drawArrays(gl.TRIANGLES, 0, 3);
  common(mesh); gl.uniform1f(mesh.u.uFade, 1); drawn = 0;
  for (let dz = -meshRing; dz <= meshRing; dz++) for (let dx = -meshRing; dx <= meshRing; dx++) {
    const b = buffers.get((cx + dx) + ',' + (cz + dz)), ox = (cx + dx) * CELL - pose.eastM, oz = (cz + dz) * CELL - pose.northM;
    if (!b || ox * f[0] - pose.altitudeM * f[1] + oz * f[2] < -260) continue;   // wholly behind the eye
    gl.uniform3f(mesh.u.uOffset, ox, -pose.altitudeM, oz); gl.bindVertexArray(b.vao); gl.drawArrays(gl.TRIANGLES, 0, b.count); drawn++;
  }
  frames++; if (frames === 3) resolveReady();
}
function hud() {
  $('mode').textContent = script ? 'JOURNEY' : pose.mode === 'walk' ? 'WALK' : 'FLIGHT';
  const g = ground(pose.eastM, pose.northM), up2 = pose.altitudeM - g;
  $('where').textContent = `E ${pose.eastM.toFixed(0)} m · N ${pose.northM.toFixed(0)} m · ${up2 < 1000 ? up2.toFixed(1) + ' m' : (up2 / 1000).toFixed(2) + ' km'} above the street`;
}
function frame(t) {
  if (disposed) return;
  const dt = Math.min(.25, last ? (t - last) / 1000 : 0); last = t;
  try { step(dt); draw(); if (frames % 6 === 0) hud(); } catch (error) { $('error').textContent = error.message; disposed = true; return; }
  requestAnimationFrame(frame);
}

/* ---- contract ---- */
function ascend(options) {
  if (script) return Promise.resolve('taken-over');
  status('Lifting off. The city goes on.');
  const handoff = options?.handoff === true, top = Math.min(4e6, Math.max(REVEAL_M, Number(options?.toAltitudeM) || REVEAL_M));
  if (pose.altitudeM >= top * .98) return Promise.resolve('revealed');   // already there
  const from = { ...pose }, to = { ...pose, altitudeM: top, pitch: handoff ? -1.5 : -.9, yaw: pose.yaw + 1.7 };   // the view turns as it climbs
  if (from.mode === 'walk') from.altitudeM = Math.max(from.altitudeM, EYE);
  // For a handoff the climb keeps gathering pace to the end, so the host's picture can take over a view already moving.
  // Climbing into its own Duck Blind: rise beneath the ordinary sky, then a few seconds of cloud
  // gathering while still climbing. Height and view are paced separately.
  const shape = handoff ? ascentShape(from.altitudeM, top, AIR.blind) : null;
  return new Promise(done => { script = { from, to, keep: held ?? { ...pose }, t: 0, seconds: 16, done, interruptible: true, shape, ease: handoff ? t => .25 * t + .75 * t * t * t : null }; });
}
let resolveArrived; const arrived = new Promise(r => { resolveArrived = r; });
function arriveFromAir(keep, fromM, hold, viaBlind) {
  const to = { eastM: 0, northM: -150, altitudeM: 60, yaw: 0, pitch: -.32, mode: 'flight' }, high = fromM > 2400;
  const from = high ? { ...to, northM: -1650, altitudeM: Math.min(fromM, 4e6), pitch: -1.5, yaw: to.yaw - 1.6 } :   // and turns as it comes down
    { ...to, northM: -5200, altitudeM: 2400, pitch: -.42 };
  pose = { ...from }; status('On approach.');
  // From a great height the descent starts at full pace (the host's picture was already falling) and settles at the end.
  // Out of its own Duck Blind (canon): a few seconds in obscuring cloud, the fast fall away of
  // concealment with the ground first discernible straight below, then the descent.
  const shape = viaBlind ? arrivalShape(from.altitudeM, to.altitudeM, AIR.blind) : null;
  script = { from, to, keep, t: 0, seconds: shape ? 15 : high ? 13.5 : 13, shape, held: hold, ease: high ? t => 1 - (1 - t) ** 3 : null, interruptible: false, done: () => { status('Arrived above the city · Q descends · F lands'); resolveArrived('arrived'); } };
}
function begin() { if (script?.held) script.held = false; return arrived; }
function dispose() { if (disposed) return; save(); disposed = true; for (const b of buffers.values()) { gl.deleteBuffer(b.vbo); gl.deleteVertexArray(b.vao); } buffers.clear(); gl.deleteProgram(mesh.p); gl.deleteProgram(plane.p); }

const query = new URLSearchParams(location.search), arrival = query.get('arrival') ?? 'saved', had = load();
if (arrival === 'ground' || (arrival === 'saved' && !had)) pose = start();
const geographic=window.frameElement?.surfaceEntry;
if(geographic?.geographic){pose={...geographic.pose};const floor=ground(pose.eastM,pose.northM)+EYE;
  pose.altitudeM=pose.mode==='walk'?floor:Math.max(floor,pose.altitudeM);
  if(solid(pose.eastM,pose.northM,pose.altitudeM)){pose.mode='flight';while(solid(pose.eastM,pose.northM,pose.altitudeM))pose.altitudeM+=2;}}
if (arrival === 'air') arriveFromAir(had ? { ...pose } : start(), query.get('fromM') === 'blind' && AIR.blind ? (AIR.blind.baseM + AIR.blind.topM) / 2 : Number(query.get('fromM')) || 0, query.get('hold') === '1', query.get('fromM') === 'blind'); else resolveArrived('ground');
// The arrival is read once: a reload of this page opens the saved place, not the arrival again.
if (query.has('arrival')) { const address = new URL(location.href); for (const key of ['arrival', 'hold', 'fromM']) address.searchParams.delete(key); history.replaceState(null, '', address.href); }
window.SphereBiome = { contract: 'sphere-biome/1', id: ID, version: VERSION, ready, arrived, pose: () => ({ ...pose }), ascend, begin, save, dispose, air: () => structuredClone(AIR), inspect: () => ({ veil: +veilAt(pose.altitudeM).toFixed(3), frames, cellsBuilt: built, buffers: buffers.size, cellsDrawn: drawn, meshRing, scripted: !!script, held: !!script?.held }) };

canvas.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); canvas.focus(); });
canvas.addEventListener('pointermove', e => { if (!drag || script) return; held = null; pose.yaw += (e.clientX - drag[0]) * .004; pose.pitch = Math.max(-1.5, Math.min(1.5, pose.pitch - (e.clientY - drag[1]) * .004)); drag = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', () => { drag = null; });
window.addEventListener('keydown', e => { if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'ShiftLeft', 'ShiftRight', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyZ', 'KeyX'].includes(e.code)) { e.preventDefault(); interrupt(); } if (e.code === 'Space' && !e.repeat) lift(); if (e.code === 'KeyF' && !e.repeat) land(); keys.add(e.code); });
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
window.addEventListener('pagehide', dispose);
$('lift').onclick = () => { interrupt(); lift(); canvas.focus(); };
$('land').onclick = () => { land(); canvas.focus(); };
$('save').onclick = () => { bookmark = { ...pose }; status(save() ? 'Place saved.' : 'This browser would not keep the save.'); };
$('back').onclick = () => { if (!script) { pose = { ...bookmark }; status('Back at your saved place.'); } };
$('leavePack').onclick = () => { dispose(); location.assign(new URL('../../../index.html', import.meta.url).href); };
setInterval(() => { if (!disposed) save(); }, 5000);
status(pose.mode === 'walk' ? 'On foot · WASD walks · drag to look · Space lifts off' : 'Flying · W goes where you look');
requestAnimationFrame(frame);
