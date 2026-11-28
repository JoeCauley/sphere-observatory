import {wallWindow,wallCamera} from './wall-stream.mjs';
import {freightFloorGLSL,freightFloorTint} from '../../kit/freight-floor.mjs';
import {freightAt} from './station.mjs';
import {makeMeadowDoorPictures} from './meadow-door-pictures.mjs';
import {displayToRadianceGLSL,indoorPathGLSL} from '../../kit/bridge-biome.mjs';
import {districtViewReachM,outsideDistrict,hallHalfM,linkHalfM,roofSlabM,freightSlabDepthM,apronRunM,apronTopM,apronShoulderM,apronHalfWidthsM,rightSign,facadeRib,spacingM,nearestSiteIndex,stationHash,doorOffset,doorSizes} from './district.mjs';
import {ribSpacing,ribs,surfaceNoise,outfallMaterials} from '../../kit/outfall-wall.mjs';
import {galleryBoxes,galleryTubes} from '../../kit/outfall-gallery.mjs';
import {plantPatch,growWallPlants} from './wall-plants.mjs';
import {drawPlant,drainBank,feedPipe,wheel,gaugeBottom,gaugeTop} from './maintenance.mjs';
import {bayStart,bayEnd,bayHalf,quayZ,freightBay,inFreightOpening} from './freight-bay.mjs';

const steel=[.27,.35,.36], lightSteel=[.50,.61,.60], concrete=[.38,.43,.42],
  amber=[.97,.62,.20], dark=[.15,.20,.22];
// A negative green channel tags the finished service deck for its painted guide.
// Blue offsets mark poured floors, tread plates, crane steel and the freight well liner.
const apronFloor=[.34,.365,2+.345],yardFloor=[.39,.414,2+.39],concreteDeck=[concrete[0],concrete[1],2+concrete[2]];
// Formwork and the ceiling beneath the through-lane share the same cast concrete.
const retainingConcrete=[.43,.445,6+.423];
const freightBridge=[freightFloorTint[0],freightFloorTint[1],7+freightFloorTint[2]-2];
const carrierDeck=[lightSteel[0],lightSteel[1],3+lightSteel[2]];
const serviceDeck=[lightSteel[0],-lightSteel[1],3+lightSteel[2]];
// Store a face's four corners, normal and tint once. The first six floats in
// each GPU mesh select the two triangles, including on shared WebGL contexts.
const faceCorners=[0,1,2,0,2,3], faceFloats=18;
export function mesh(packedFaces) {
  const data=packedFaces?[...faceCorners]:[];
  const face=(a,b,c,d,col)=>{
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    const length=Math.hypot(nx,ny,nz)||1;
    nx/=length;ny/=length;nz/=length;
    if(packedFaces){
      const last=d??c;
      data.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2],last[0],last[1],last[2],nx,ny,nz,col[0],col[1],col[2]);
    }else{
      for(const p of d?[a,b,c,a,c,d]:[a,b,c])data.push(p[0],p[1],p[2],nx,ny,nz,col[0],col[1],col[2]);
    }
  };
  const quad=face;
  const tri=(a,b,c,col)=>face(a,b,c,null,col);
  const box=(x0,x1,y0,y1,z0,z1,col)=>{
    if(x1<=x0||y1<=y0||z1<=z0)return;
    const a=[x0,y0,z0],b=[x1,y0,z0],c=[x1,y0,z1],d=[x0,y0,z1],
      e=[x0,y1,z0],f=[x1,y1,z0],g=[x1,y1,z1],h=[x0,y1,z1];
    quad(a,e,f,b,col);quad(b,f,g,c,col);quad(c,g,h,d,col);quad(d,h,e,a,col);
    quad(e,h,g,f,col);quad(a,b,c,d,col);
  };
  return {data,quad,tri,box};
}

// Negative blue tags roof faces for the shared shader without another vertex attribute.
const gridDeck=[steel[0],steel[1],-steel[2]], gridRib=[lightSteel[0],lightSteel[1],-lightSteel[2]];
const gridLamp=[1,.8,-.45],wellLiner=[steel[0],steel[1],5+steel[2]];
const gridSpacingX=800,gridSpacingZ=700,gridFirstZ=450;

function yardRoof(m,x,mid,half,roof) {
  const deck=x===0?gridDeck:steel,top=roof+roofSlabM;
  const left=x-hallHalfM,right=x+hallHalfM,near=mid-half,far=mid+half;
  const start=x+bayStart,end=x+bayEnd,front=mid-bayHalf,back=mid+bayHalf;
  const panel=(lo,hi,z0,z1)=>{
    m.quad([lo,top,z0],[lo,top,z1],[hi,top,z1],[hi,top,z0],deck);
    m.quad([lo,roof,z0],[hi,roof,z0],[hi,roof,z1],[lo,roof,z1],deck);
  };
  const side=(x0,z0,x1,z1,tint)=>{
    m.quad([x0,roof,z0],[x0,top,z0],[x1,top,z1],[x1,roof,z1],tint);
  };
  panel(left,start,near,far);panel(end,right,near,far);
  panel(start,end,near,front);panel(start,end,back,far);
  side(left,near,right,near,deck);side(right,near,right,far,deck);
  side(right,far,left,far,deck);side(left,far,left,near,deck);
  // Give the four exposed cut faces a single material all the way to their corners.
  side(start,front,start,back,wellLiner);side(start,back,end,back,wellLiner);
  side(end,back,end,front,wellLiner);side(end,front,start,front,wellLiner);
}

function yardMachinery(m,offset,mid,roof,distant=false) {
  for(const p of freightBay(roof)) {
    if(distant && p.x1-p.x0<6)continue;
    const x0=offset+p.x0,x1=offset+p.x1,z0=mid+p.z0,z1=mid+p.z1;
    const tint=[p.color[0],p.color[1],4+p.color[2]];
    if(!p.rise){m.box(x0,x1,p.y0,p.y1,z0,z1,tint);continue;}
    const a=[x0,p.y0,z0],b=[x1,p.y0,z0],c=[x1,p.y0+p.rise,z1],d=[x0,p.y0+p.rise,z1];
    const e=[x0,p.y1,z0],f=[x1,p.y1,z0],g=[x1,p.y1+p.rise,z1],h=[x0,p.y1+p.rise,z1];
    m.quad(a,e,f,b,tint);m.quad(b,f,g,c,tint);m.quad(c,g,h,d,tint);
    m.quad(d,h,e,a,tint);m.quad(e,h,g,f,tint);m.quad(a,b,c,d,tint);
  }
}

function endWalls(m,x,mid,half,roof){
  for(const wall of [x-hallHalfM,x+hallHalfM]){
    m.box(wall-1,wall+1,0,roof,mid-half,mid-linkHalfM,concrete);
    m.box(wall-1,wall+1,0,roof,mid+linkHalfM,mid+half,concrete);
  }
}

function apronRoad(m,center,width,front,back){
  const half=width/2+apronShoulderM;
  // The wearing course sits just above the native terrain datum.
  for(const [start,end] of [[front-apronRunM,front],[back,back+apronRunM]])
    m.box(center-half,center+half,-12,apronTopM,start,end,apronFloor);
}

// The exposed retaining wall follows the heavy ramp until its upper edge
// meets the station slab. Split that crossing so the wall never cuts a
// diagonal gap into the level pavement at the deepest part of the route.
function trenchWall(m,x,y0,z0,y1,z1,height) {
  const slab=.02;
  const wall=(a,b,c,d)=>m.quad([x,a,b],[x,Math.max(slab,a+height),b],
    [x,Math.max(slab,c+height),d],[x,c,d],retainingConcrete);
  const crossing=(slab-height-y0)/(y1-y0);
  if(crossing>0 && crossing<1){
    const z=z0+(z1-z0)*crossing;
    wall(y0,z0,slab-height,z);wall(slab-height,z,y1,z1);
  }else wall(y0,z0,y1,z1);
}

function visibleStations(district,s){
  const here=nearestSiteIndex(district,s.address.chainageM);
  return district.sites.slice(Math.max(0,here-2),here+3)
    .filter(bay=>Math.abs(bay.x-s.address.chainageM)<=2*spacingM);
}

function frontWall(m,s,z){
  let last=-hallHalfM;
  for(const r of [...s.routes].sort((a,b)=>a.nearDoor[0]-b.nearDoor[0])){
    // Cut the concrete back to the outside of the frame. Coincident reveals
    // previously alternated orange and grey when looking along a jamb.
    const x=r.nearDoor[0],rough=r.door[0]/2+.48;
    m.box(last,x-rough,0,s.roofM,z-1,z+1,concrete);
    m.box(x-rough,x+rough,r.door[1]+1,s.roofM,z-1,z+1,concrete);last=x+rough;
  }
  m.box(last,hallHalfM,0,s.roofM,z-1,z+1,concrete);
}

function districtShell(m,s,district,distant){
  const mid=s.widthM/2;
  const visible=visibleStations(district,s);
  for(const bay of visible){
    if(bay.x===s.address.chainageM && !distant)continue;
    const x=bay.x-s.address.chainageM,front=mid-bay.widthM/2,back=mid+bay.widthM/2;
    // At long range the roof and floor can quantize to the same depth.
    // Submit the exterior deck before the covered floor on these shells.
    yardRoof(m,x,mid,bay.widthM/2,bay.roofM);
    const seed=stationHash(bay.address.key);
    for(const route of [0,1,3])apronRoad(m,x+doorOffset(seed,route),doorSizes[route][0],front,back);
    m.box(x-hallHalfM,x+hallHalfM,-10,0,front,back,yardFloor);
    if(bay.x===s.address.chainageM){
      for(const z of [front,back])frontWall(m,s,z);
    }else{
      m.box(x-hallHalfM,x+hallHalfM,0,bay.roofM,front,front+2,concrete);
      m.box(x-hallHalfM,x+hallHalfM,0,bay.roofM,back-2,back,concrete);
    }
    // End walls stop at the through freight line.
    endWalls(m,x,mid,bay.widthM/2,bay.roofM);
    yardMachinery(m,x,mid,bay.roofM,true);
  }
}

export function stationMesh(s,district=null,packedFaces=false) {
  const m=mesh(packedFaces),mid=s.widthM/2,left=-hallHalfM,right=hallHalfM,heavy=s.routes[2];
  const trench=heavy.nearDoor[0],hw=heavy.door[0]/2+5;
  for(const [lo,hi] of [[left,trench-hw],[trench+hw,right]]){
    // The finished floor must sit above the supported native terrain in the
    // shared galleries. The access deck and its guides rise from this surface.
    m.box(lo,hi,-12,.02,0,mid-s.laneHalfM,yardFloor);
    m.box(lo,hi,-12,0,mid-s.laneHalfM,mid+s.laneHalfM,freightFloorTint);
    m.box(lo,hi,-12,.02,mid+s.laneHalfM,s.widthM,yardFloor);
    for(const z of [-500,-325,325,500])m.box(lo,hi,0,.13,mid+z-2,mid+z+2,lightSteel);
  }
  // The five-metre shoulder between the paving and each retaining wall
  // shares edges with both. Its top stays at the same datum as the hall.
  for(const side of [-1,1]){
    const edge=trench+side*heavy.deckWidthM/2,lip=trench+side*hw;
    const x0=Math.min(edge,lip),x1=Math.max(edge,lip);
    for(const [z0,z1] of [[0,mid-s.laneHalfM],[mid+s.laneHalfM,s.widthM]])
      m.quad([x0,.02,z0],[x0,.02,z1],[x1,.02,z1],[x1,.02,z0],yardFloor);
  }
  for(const route of s.routes){
    if(route===heavy)continue;
    apronRoad(m,route.nearDoor[0],route.door[0],0,s.widthM);
  }
  // The deck above the underground route carries the same longitudinal freight slab.
  m.box(trench-hw,trench+hw,-freightSlabDepthM,0,mid-s.laneHalfM,mid+s.laneHalfM,freightBridge);
  if(district){
    yardRoof(m,0,mid,mid,s.roofM);
    endWalls(m,0,mid,mid,s.roofM);
    yardMachinery(m,0,mid,s.roofM);
  }else m.box(left,right,s.roofM,s.roofM+roofSlabM,0,s.widthM,gridDeck);
  for(let x=left;x<=right;x+=gridSpacingX){
    if(district && x>bayStart && x<bayEnd){
      m.box(x-5,x+5,s.roofM-18,s.roofM-.15,0,mid-bayHalf,gridRib);
      m.box(x-5,x+5,s.roofM-18,s.roofM-.15,mid+bayHalf,s.widthM,gridRib);
    }else m.box(x-5,x+5,s.roofM-18,s.roofM-.15,0,s.widthM,gridRib);
    for(const z of [mid-s.laneHalfM-420,mid+s.laneHalfM+420]){
      if(district && inFreightOpening(x,z-mid))continue;
      if(s.routes.some(r=>Math.abs(r.nearDoor[0]-x)<r.deckWidthM/2+50))continue;
      m.box(x-18,x+18,0,s.roofM,z-18,z+18,concrete);
      m.box(x-20,x+20,45,49,z-20,z+20,amber);
    }
  }
  for(let z=gridFirstZ;z<s.widthM;z+=gridSpacingZ){
    const spans=district && Math.abs(z-mid)<bayHalf ? [[left,bayStart],[bayEnd,right]] : [[left,right]];
    for(const [lo,hi] of spans){
      m.box(lo,hi,s.roofM-12,s.roofM-.15,z-5,z+5,gridRib);
      m.box(lo,hi,s.roofM-13,s.roofM-12,z-1,z+1,gridLamp);
    }
  }
  for(const r of s.routes){
    const width=r.deckWidthM/2,x=r.nearDoor[0];
    for(let i=1;i<r.points.length;i++){
      const [,ay,az]=r.points[i-1],[,by,bz]=r.points[i],depth=r.deckDepthM;
      const y0=ay+.04,y1=by+.04;
      m.quad([x-width,y0,az],[x-width,y1,bz],[x+width,y1,bz],[x+width,y0,az],
        r.id==='service'?serviceDeck:r.id==='carrier'?carrierDeck:concreteDeck);
      if(depth){
        m.quad([x+width,by-depth,bz],[x-width,by-depth,bz],[x-width,ay-depth,az],[x+width,ay-depth,az],steel);
        for(const side of [-1,1]){
          const edge=x+side*width;
          m.quad([edge,y0,az],[edge,y1,bz],[edge,by-depth,bz],[edge,ay-depth,az],steel);
          if(r.id==='heavy')trenchWall(m,edge,y0,az,y1,bz,r.door[1]);
        }
      }
      if(r.id==='service'||r.id==='carrier'){
        const gap=r.id==='service'?16:50,bar=r.id==='service'?.055:.3,railHeight=r.id==='service'?1.15:3;
        for(const side of [-1,1]){
          const edge=x+side*width;
          let bay=r.id==='service'&&side===1?s.lookout:null;
          // Leave an operator bay on the plant side of each level landing.
          // The far installation is rotated through 180 degrees.
          if(district && r.id==='service' && ((az===0 && side===-1) || (bz===s.widthM && side===1))){
            const center=side<0?2+wheel.z:s.widthM-2-wheel.z;
            bay={near:center-1.8,far:center+1.8};
            for(const z of [bay.near,bay.far])
              m.box(edge-bar,edge+bar,y0,y0+railHeight,z-bar,z+bar,steel);
          }
          const portions=bay?[[az,Math.min(bz,bay.near)],[Math.max(az,bay.far),bz]]:[[az,bz]];
          for(const [front,back] of portions)if(back>front){
            const railY=z=>y0+railHeight+(y1-y0)*(z-az)/(bz-az);
            m.quad([edge,railY(front),front],[edge,railY(back),back],[edge,railY(back)+bar*2,back],[edge,railY(front)+bar*2,front],amber);
          }
          const first=Math.ceil(Math.max(az,mid-1550)/gap)*gap;
          for(let z=first;z<Math.min(bz,mid+1550);z+=gap){
            if(bay&&z>bay.near&&z<bay.far)continue;
            const y=y0+(y1-y0)*(z-az)/(bz-az);
            m.box(edge-bar,edge+bar,y,y+railHeight,z-bar,z+bar,steel);
          }
        }
      }
    }
    for(const z of [0,s.widthM]){
      const [w,h]=r.door;
      for(const side of [-1,1]){
        const edge=x+side*w/2;
        m.box(edge+(side<0?-.48:0),edge+(side<0?0:.48),0,h,z-1.22,z+1.22,amber);
      }
      m.box(x-w/2-.48,x+w/2+.48,h,h+1,z-2,z+2,amber);
    }
    if(r.id==='service'||r.id==='carrier'){
      const top=r.points[2][1];
      for(const sign of [-1,1]){
        const z=mid+sign*(s.laneHalfM+80);
        m.box(x-width-1,x+width+1,0,top-r.deckDepthM,z-6,z+6,concrete);
      }
    }
  }
  if(district){
    // Paired lights and unbroken edge lines give each portal a familiar scale from the apron and from inside.
    for(const r of s.routes.slice(0,2)){
      const x=r.nearDoor[0],half=r.door[0]/2,k=r.id==='service'?1:3;
      for(const side of [-1,1])for(const far of [false,true]){
        const edge=x+side*(half-.14*k),z0=far?s.widthM-340:0;
        m.box(edge-.045*k,edge+.045*k,.05,.065,z0,z0+340,amber);
        for(const start of [8,32,80,160,320]){
          const z=far?s.widthM-start:start,rim=x+side*(half+.45*k);
          m.box(rim-.08*k,rim+.08*k,0,2.4*k,z-.12*k,z+.12*k,steel);
          m.box(rim-.22*k,rim+.22*k,1.9*k,2.25*k,z-.20*k,z+.20*k,[1,.88,.57]);
        }
      }
    }
  }
  if(s.lookout){
    const {west,east,near,far,y}=s.lookout;
    m.box(west,east,y-1.8,y+.04,near,far,carrierDeck);
    for(const z of [near,far]){
      m.box(west,east,y+1.12,y+1.20,z-.05,z+.05,amber);
      for(let x=west;x<=east;x+=2.5)m.box(x-.055,x+.055,y,y+1.15,z-.055,z+.055,steel);
    }
    m.box(east-.05,east+.05,y+1.12,y+1.20,near,far,amber);
    for(let z=near;z<=far;z+=2.5)m.box(east-.055,east+.055,y,y+1.15,z-.055,z+.055,steel);
  }
  // The near and far facades use the exact same opening dimensions as the route fit check.
  for(const z of [0,s.widthM]){
    frontWall(m,s,z);
    if(district){
      const face=z===0?-1:1;
      const door=s.routes[0].nearDoor[0];
      const place=([x,y,depth])=>[door-face*x,y,z-face*(2+depth)];
      drawPlant(m,place);
      for(const [x,y,depth,w,h,d,tint,kind] of galleryBoxes){
        const [cx,cy,cz]=place([x,y,depth]);
        m.box(cx-w/2,cx+w/2,cy-h/2,cy+h/2,cz-d/2,cz+d/2,kind===3?[1,.88,.57]:tint);
      }
      for(const [[x,y,start],[,,end],radius,tint] of [...galleryTubes,feedPipe]){
        const rim=(k,depth)=>place([x+radius*Math.cos(k*Math.PI/7),y+radius*Math.sin(k*Math.PI/7),depth]);
        for(let k=0;k<14;k++){
          m.quad(rim(k,start),rim(k+1,start),rim(k+1,end),rim(k,end),tint);
          m.tri(place([x,y,start]),rim(k+1,start),rim(k,start),tint);
          m.tri(place([x,y,end]),rim(k,end),rim(k+1,end),tint);
        }
      }
      for(let i=Math.ceil(left/ribSpacing);i<=Math.floor(right/ribSpacing);i++){
        if(!facadeRib(s,i))continue;
        const x=i*ribSpacing;
        for(const [w,h,front,back] of ribs){
          const a=z+face*(1-front),b=z+face*(1-back);
          m.box(x-w,x+w,0,h,Math.min(a,b),Math.max(a,b),[.32,.37,.35]);
        }
      }
    }
  }
  const fx=s.floorRoute.points[2][0];
  for(const sign of [-1,1]){
    const z=mid+sign*(s.laneHalfM+60);
    m.box(fx-8,fx+8,0,.04,z-12,z+12,carrierDeck);
    for(const line of [-10,10])m.box(fx-8,fx+8,.04,.065,z+line-.12,z+line+.12,amber);
    m.box(fx+8,fx+9,0,4.5,z-10,z+10,lightSteel);
  }
  if(district){
    // From 61 km up the far roof and its trunk are visible across the middle
    // hall. Keep the exteriors of this surveyed district as detail changes bays.
    districtShell(m,s,district,false);
    // The paved approach converges on the same opening in the adjoining plot.
    for(const r of s.routes.slice(0,2)){
      const x=r.nearDoor[0],w=r.door[0],k=w/4;
      for(const far of [false,true]){
        const wall=far?s.widthM:0,sign=far?1:-1;
        for(const side of [-1,1]){
          const edge=x+side*(w/2+.8*k);
          m.box(edge-.12*k,edge+.12*k,.04,.055,wall+(far?0:-115*k),wall+(far?115*k:0),amber);
          for(const dist of [6,18,40,74,112]){
            const z=wall+sign*dist*k,pole=edge+side*.8*k;
            m.box(pole-.11*k,pole+.11*k,0,1.75*k,z-.14*k,z+.14*k,steel);
            m.box(pole-.15*k,pole+.15*k,1.75*k,2.0*k,z-.17*k,z+.17*k,[1,.86,.53]);
          }
          const pier=x+side*(w+1.5*k);
          m.box(pier-.5*k,pier+.5*k,0,10*k,wall-2.4*k,wall+2.4*k,steel);
          m.box(pier-.55*k,pier+.55*k,8.5*k,9.6*k,wall-2.5*k,wall+2.5*k,amber);
        }
      }
    }
  }
  return m.data;
}

export function freightMesh(t,packedFaces=false) {
  const m=mesh(packedFaces),l=t.lengthM/2,w=t.widthM/2;
  m.box(-l,l,12,52,-w+10,w-10,dark);m.box(-l+6,l-6,48,63,-w,w,amber);
  const paint=[.35,.45,.46];
  for(let i=0;i<6;i++){
    const a=-l+24+i*(t.lengthM-48)/6,b=a+(t.lengthM-48)/6-10;
    m.box(a,b,63,110,-w+12,w-12,steel);
    if(i%3===1){
      // A flanged cylinder on two cradles gives the traveler a recognizable curved outline.
      const radius=(t.heightM-108)/2-3,cy=t.heightM-radius-3;
      const rim=(x,k,r)=>[x,cy+r*Math.cos(k*Math.PI/12),r*Math.sin(k*Math.PI/12)];
      for(let k=0;k<24;k++){
        m.quad(rim(a+10,k+1,radius),rim(b-10,k+1,radius),rim(b-10,k,radius),rim(a+10,k,radius),paint);
        for(const x of [a+10,b-13])m.quad(rim(x,k+1,radius+3),rim(x+3,k+1,radius+3),rim(x+3,k,radius+3),rim(x,k,radius+3),lightSteel);
        for(const [x,flip] of [[a+10,1],[b-10,0]])m.quad([x,cy,0],rim(x,k+flip,radius),rim(x,k+1-flip,radius),[x,cy,0],steel);
      }
    }else{
      m.box(a+8,b-8,110,t.heightM-25,-w+28,w-28,paint);
      m.box(a+17,b-17,t.heightM-25,t.heightM,-w+50,w-50,lightSteel);
      for(let x=a+23;x<b-18;x+=34)for(const side of [-1,1]){
        const z=side*(w-27);m.box(x-1.8,x+1.8,143,t.heightM-40,z-2,z+2,steel);
      }
    }
    for(const x of [a+14,b-14]){
      m.box(x-3,x+3,65,t.heightM-20,-w+23,w-23,lightSteel);
      for(const side of [-1,1])m.box(x-12,x+12,0,15,side*(w-7)-7,side*(w-7)+7,dark);
    }
    for(const side of [-1,1])m.box(a+14,b-14,129,133,side*(w-25)-1,side*(w-25)+1,amber);
    // Access galleries and traction housings repeat with the car, in its own metres.
    for(const side of [-1,1]){
      const z=side*(w-6);
      for(const x of [a+36,b-36]){
        m.box(x-23,x+23,6,25,z-5,z+5,steel);
        m.box(x-18,x+18,15,19,z-6,z+6,lightSteel);
        m.box(x-12,x+12,20,23,z-6,z+6,dark);
      }
      for(let x=a+30;x<b-18;x+=48){
        m.box(x-6,x+6,31,40,z-4,z+4,dark);
        m.box(x-4,x+4,36,37,z-4.5,z+4.5,[1,.84,.59]);
      }
    }
  }
  return m.data;
}

const vertex=`#version 300 es
layout(location=0) in float corner;
in vec3 cornerA,cornerB,cornerC,cornerD,normal,tint;
uniform vec3 eye,right,up,forward,offset; uniform vec2 focal,clip;uniform bool foliage;
out vec3 color;out vec3 materialPoint;out vec2 floorRelative;out float surfaceY;flat out float instrument;uniform vec3 hall;uniform vec4 nearDrain,farDrain;flat out vec3 faceNormal;flat out float fixtureLight,sideNormal;flat out int roofGrid,surfaceKind;
void main(){
 vec3 position=corner<.5?cornerA:corner<1.5?cornerB:corner<2.5?cornerC:cornerD;
 instrument=tint.g<0.?-1.:max(0.,-tint.r);
 if(instrument>=5.){
   vec4 response=position.z<hall.x*.5?nearDrain:farDrain;
   position.y=.30+.50*response[int(instrument)-5];
 }
 if(foliage)position=mix(position,cornerA,smoothstep(64.,92.,length(cornerA-eye)));
 vec3 d=position+offset-eye;float z=dot(d,forward);
 gl_Position=vec4(dot(d,right)*focal.x,dot(d,up)*focal.y,z*clip.x-clip.y,z);
 float lighting=.52+.28*max(normal.y,0.)+.15*abs(normal.x)+.07*max(-normal.z,0.);
 roofGrid=int(tint.b<0. && (normal.y<-.9 || max(cornerA.y,cornerC.y)<hall.y));
 // Blue offsets carry a per-face material tag. Both triangles in a face share it.
 int tag=int(floor(max(0.,tint.b-1.)));
 surfaceKind=tag==6?(normal.y>.85?1:5):(tag>=3 || normal.y>.85?tag:0);
 float blue=tag>0?tint.b-float(tag+1):abs(tint.b);
 color=vec3(tint.r,abs(tint.g),blue)*lighting;materialPoint=position;floorRelative=position.xz-eye.xz;surfaceY=normal.y;faceNormal=normal;
 fixtureLight=step(.94,tint.r)*step(.78,tint.g);
 sideNormal=abs(normal.x);
}`;
const fragment=(mainDepth,localDepth,packDepth)=>`#version 300 es
precision highp float;in vec3 color,materialPoint;in vec2 floorRelative;in float surfaceY;flat in float instrument;uniform vec4 nearDrain,farDrain;flat in vec3 faceNormal;flat in float fixtureLight,sideNormal;flat in int roofGrid,surfaceKind;uniform int mask;uniform bool structure;
uniform bool foliage,nativeDepth,plainWall;uniform float wallAir;uniform vec3 wallStationOffset;uniform bool stationAir;uniform vec2 clip;
uniform vec2 plateOrigin;uniform mat2 plateAxes;uniform vec3 apronCenters;
uniform float direct,workLight; uniform bool yard;uniform vec2 habitats;uniform vec3 hall,eye,offset,loadFootprint;out vec4 frag;
${surfaceNoise}
${outfallMaterials}
${freightFloorGLSL}
float ruledLine(float d,float halfWidth,float pixel){
 return (1.-smoothstep(halfWidth,halfWidth+max(.02,pixel),d))*halfWidth/max(halfWidth,pixel);
}
// Metre-scale plates and larger expansion joints share one finish across the hall sill.
vec3 plateFinish(vec3 base,vec2 uv,vec2 pitch){
 vec2 fw=max(fwidth(uv),vec2(.002)),cell=uv/pitch;
 vec2 lip=filteredStrips(cell,fw/pitch,vec2(.085)/pitch);
 vec2 bevel=filteredStrips((uv-.13)/pitch,fw/pitch,vec2(.060)/pitch);
 vec2 expansion=filteredStrips(uv/vec2(640.,320.),fw/vec2(640.,320.),vec2(.9,1.2)/vec2(640.,320.));
 vec2 panels=mod(floor(cell),32000./pitch);
 float plate=(hash(panels)-.5)*(1.-smoothstep(.09,.5,max(fw.x/pitch.x,fw.y/pitch.y)));
 float roll=(noise2(mod(uv,32000.)*vec2(1.2,19.))-.5)*(1.-smoothstep(.012,.055,max(fw.x,fw.y)));
 vec2 edge=abs(fract(cell+.5)-.5)*pitch;
 float bolt=1.-smoothstep(.052,.072+max(fw.x,fw.y),length(edge-vec2(.23,.20)));
 return base*(1.+.065*plate+.038*roll-.32*max(lip.x,lip.y)+.12*max(bevel.x,bevel.y)
   -.24*max(expansion.x,expansion.y)+.16*bolt*(1.-smoothstep(.035,.17,max(fw.x,fw.y))));
}
// The entire grid is visible from ground level. Integrate each rib's bottom and
// side silhouettes at their own heights; thin lamps can occupy a fraction of a pixel.
vec3 wheelWear(vec3 finish,float across,float pixel){
 float gauge=abs(abs(mod(across+16000.,32000.)-16000.)-323.);
 float wear=(1.-smoothstep(2.8,8.5+pixel,gauge))*(1.-smoothstep(4.,24.,pixel));
 return mix(finish,finish*vec3(.80,.84,.85),wear);
}
vec3 ceilingLight(vec3 ordinary,float daylight,float distanceM){
 vec3 ray=materialPoint-eye;
 if(ray.y<=0. || eye.y>=hall.y-18. || distanceM<120.)return ordinary;
 vec2 slope=ray.xz/ray.y,period=vec2(${gridSpacingX}.,${gridSpacingZ}.);
 vec2 depth=vec2(18.,12.),phase=vec2(0.,${gridFirstZ}.);
 vec2 roof=materialPoint.xz+(hall.y-materialPoint.y)*slope;
 vec2 bottom=roof-depth*slope-phase;
 vec2 pixel=max(fwidth(bottom),vec2(.02));
 vec2 sideRun=(depth-.15)*slope;
 vec2 beam=stripCoverage((bottom+.5*sideRun)/period,pixel/period,min(vec2(1.),(10.+abs(sideRun))/period));
 vec2 underside=min(beam,stripCoverage(bottom/period,pixel/period,10./period));
 float lampRun=slope.y;
 float lamp=stripCoverage(vec2((bottom.y-.5*lampRun)/period.y),vec2(pixel.y/period.y),vec2(min(1.,(2.+abs(lampRun))/period.y))).x;
 vec3 bare=vec3(${steel})*.52*daylight;
 vec3 steelRib=vec3(${lightSteel})*daylight;
 vec3 zRib=steelRib*(.52*underside.y+(.52+.07*step(0.,slope.y))*(beam.y-underside.y));
 vec3 xRib=steelRib*(.52*underside.x+.67*(beam.x-underside.x));
 vec3 underZ=bare*(1.-beam.y)+zRib;
 // The lamp lies on the bottom of the transverse girder. Its footprint replaces
 // the corresponding steel rather than adding a second full strip of brightness.
 underZ+=lamp*(vec3(1.,.78,.46)-.52*steelRib);
 vec3 grid=underZ*(1.-beam.x)+xRib;
 // At the lip of the crane well, physical beam ends still define the silhouette.
 vec2 outer=vec2(${hallHalfM}.-abs(roof.x),min(roof.y,hall.x-roof.y));
 float reach=18.*max(abs(slope.x),abs(slope.y))+max(pixel.x,pixel.y);
 float edge=min(outer.x,outer.y);
 if(yard){
   vec2 well=abs(roof-vec2(${(bayStart+bayEnd)/2}.,hall.x*.5))-vec2(${(bayEnd-bayStart)/2}.,${bayHalf}.);
   edge=min(edge,max(well.x,well.y));
 }
 return mix(ordinary,grid,smoothstep(120.,240.,distanceM)*smoothstep(0.,max(1.,reach),edge));
}
${indoorPathGLSL}
// Return the fractions of a steel sightline in station air and outdoor biome air.
// Above a surveyed room or link, and in the open crane shaft, the path is vacuum.
vec2 airPath(vec3 eye,vec3 hit){
 vec3 ray=hit-eye;
 float footprint=indoorFraction(eye.xz,ray.xz);
 float outdoor=1.-footprint;
 if(footprint<=0. || min(eye.y,hit.y)>=hall.y)return vec2(0.,outdoor);
 float start=0.,end=1.;
 if(max(eye.y,hit.y)>hall.y){
   float top=(hall.y-eye.y)/ray.y;
   if(ray.y>0.)end=top;else start=top;
 }
 float enclosed=footprint;
 if(end-start<1.)enclosed=(end-start)*indoorFraction(eye.xz+start*ray.xz,(end-start)*ray.xz);
 if(yard && enclosed>0. && max(eye.y,hit.y)>0. &&
    min(eye.z,hit.z)<hall.x*.5+${bayHalf}. && max(eye.z,hit.z)>hall.x*.5-${bayHalf}.){
   if(min(eye.y,hit.y)<0.){
     float floorT=-eye.y/ray.y;
     if(ray.y>0.)start=max(start,floorT);else end=min(end,floorT);
   }
   vec2 shaftEye=eye.xz+start*ray.xz,shaftRay=(end-start)*ray.xz;
   vec2 inv=mix(vec2(-1.),vec2(1.),greaterThanEqual(shaftRay,vec2(0.)))/max(abs(shaftRay),vec2(1e-6));
   bool local=min(eye.x,hit.x)>=airRooms[0].x && max(eye.x,hit.x)<=airRooms[0].z;
   for(int i=0;i<airRoomCount;i++){
     vec4 room=airRooms[i];
     // Only the halls have a crane well. The link boxes span the larger gaps.
     if(room.z-room.x==${2*hallHalfM}.){
       float x=room.x+${hallHalfM}.,z=hall.x*.5;
       vec4 shaft=vec4(x+${bayStart}.,z-${bayHalf}.,x+${bayEnd}.,z+${bayHalf}.);
       enclosed-=(end-start)*indoorPath(shaft,shaftEye,inv);
     }
     if(local)break;
   }
 }
 return vec2(max(0.,enclosed),outdoor);
}
${mainDepth?'uniform float logRange;uniform bool linearOutput;':''}
${mainDepth?displayToRadianceGLSL:''}
vec3 frameColor(vec3 authored){
 ${mainDepth?'if(linearOutput)return displayToRadiance(authored);':''}
 return authored;
}
void main(){
float distanceM=length(materialPoint+offset-eye);
// Meadow shares its perspective depth buffer with these faces. Evaluate its depth at the
// fragment: interpolated vertex depth loses the separation of the two-metre wall skins
// when a triangle spans the distance between stations.
${mainDepth?'gl_FragDepth=log2(1.+distanceM*.001)/logRange;':packDepth?'gl_FragDepth=log2(1.+distanceM)/'+Math.log2(1+packDepth).toPrecision(15)+';':localDepth?'gl_FragDepth=nativeDepth ? .5*(1.+clip.x)-.5*clip.y*gl_FragCoord.w : log2(1.+distanceM)/log2(2000001.);':'gl_FragDepth=.5*(1.+clip.x)-.5*clip.y*gl_FragCoord.w;'}
if(instrument>0.){
 bool nearDoor=materialPoint.z<hall.x*.5;
 vec4 response=nearDoor?nearDrain:farDrain;
 vec3 paint=vec3(.13,.73,.73);
 if(instrument<4.){
   float line=mix(${gaugeBottom},${gaugeTop},response[int(instrument)-1]);
   paint=mix(paint,vec3(.075,.12,.13),smoothstep(line-.012,line+.012,materialPoint.y));
 }else if(instrument==4.){
   vec2 spoke=vec2((nearDoor?1.:-1.)*(materialPoint.x-hall.z)-(${wheel.x}),materialPoint.y-${wheel.y});
   float r=length(spoke),angle=atan(spoke.y,spoke.x)-1.57*response.w;
   if(r>.37 || (r>.085 && r*abs(sin(angle*1.5))>.045))discard;
   paint=cos(angle)>.8?vec3(.98,.68,.26):vec3(.58,.32,.14);
 }else{paint=vec3(.10,.42,.43);}
 frag=mask==0?vec4(frameColor(paint),1.):vec4(0.,0.,0.,1.);
 return;
}
if(mask!=0){frag=mask==2?vec4(1.,step(.65,surfaceY),step(.65,-surfaceY),1.):vec4(0.,0.,0.,1.);return;}
if(foliage){frag=vec4(frameColor(color*(.35+.65*direct)),1.);return;}
if(plainWall){
 vec2 stationUV=plateOrigin+plateAxes*materialPoint.xz;
 vec2 uv=abs(surfaceY)>.6?stationUV:vec2(stationUV.x,materialPoint.y);
 vec2 pitch=abs(surfaceY)>.6?vec2(16.,8.):vec2(80.,40.);
 vec2 pixel=max(fwidth(uv),vec2(.002));
 vec2 fineUV=mod(plateOrigin+plateAxes*eye.xz,32.)+plateAxes*floorRelative;
 vec3 material=surfaceKind==1?wheelWear(pouredFloor(color,uv,fineUV,pixel),uv.y,pixel.y):plateFinish(color,uv,pitch);
 vec3 lit=material*(.48+.52*direct);
 if(abs(surfaceY)<.6){
   // Phase wraps at 32 km. Both spacings divide that interval, so a new
   // streamed tile picks up the same formwork. Derivatives integrate distant cuts.
   vec2 form=floorCuts(uv,pixel,vec2(4.,2.),vec2(.026,.021));
   vec2 pour=floorCuts(uv,pixel,vec2(32.,8.),vec2(.12,.075));
   float scale=max(pixel.x,pixel.y);
   vec2 batch=mod(floor(uv/vec2(32.,8.)),vec2(1000.,4000.));
   lit*=1.-.27*eitherStrip(form)-.32*eitherStrip(pour)+.085*(hash(batch)-.5)*(1.-smoothstep(1.,7.,scale));
   if(scale<.16){
     vec2 tie=abs(mod(uv,vec2(2.,1.))-vec2(1.,.5));
     float recess=1.-smoothstep(.024,.038+scale,length(tie));
     lit*=1.+(.32*(outfallConcrete(uv)-1.)-.36*recess)*(1.-smoothstep(.025,.16,scale));
   }
   // Slab courses and the steel cap give an exposed 1.7 km face a readable
   // height after individual panel seams have fallen below a pixel.
   float h=materialPoint.y,fw=max(.01,fwidth(h));
   vec2 panel=vec2(uv.x/100.,h/80.),fwPanel=pixel/vec2(100.,80.);
   vec2 joints=filteredStrips(panel,fwPanel,vec2(.016,.018));
   float course=max(joints.x,joints.y);
   float base=1.-smoothstep(115.-fw,135.+fw,h);
   float cap=smoothstep(1680.-fw,1695.+fw,h);
   lit*=1.-.34*course-.16*base;
   lit=mix(lit,lit*vec3(1.13,1.10,1.02),cap);
 }
 // Native atmosphere reads the same exterior-path fraction on a link as on its hall.
 vec2 air=stationAir?airPath(eye+wallStationOffset,materialPoint+wallStationOffset):vec2(0.,wallAir);
 vec2 optical=distanceM*air/vec2(22000.,42000.);
 vec3 inside=mix(vec3(.075,.093,.11),vec3(.46,.56,.59),direct);
 float tag=1.;
 ${mainDepth?`
 if(linearOutput && air.y<1.)tag=-1.-air.y;
 lit=mix(lit,inside,1.-exp(-optical.x));`:`
 float total=optical.x+optical.y;
 vec3 tint=mix(inside,mix(vec3(.10,.13,.18),vec3(.69,.80,.84),direct),optical.y/max(total,.00001));
 lit=mix(lit,tint,1.-exp(-total));`}
 frag=vec4(frameColor(lit),tag);return;
}
float outside=max(-materialPoint.z,materialPoint.z-hall.x),across=abs(materialPoint.x-hall.z);
float amberPaint=0.,lamp=0.;
vec2 cell=materialPoint.xz/vec2(1.8,3.6),cellPixel=max(fwidth(cell),vec2(.001));
// A grazing pixel can span several transverse joints while still resolving
// a longitudinal one. Average the occupied area of each direction separately.
const float jointDuty=.024;
vec2 jointCoverage=filteredStrips(cell,cellPixel,vec2(jointDuty));
float joint=jointCoverage.x+jointCoverage.y-jointCoverage.x*jointCoverage.y;
// Once a pixel stretches across much of a slab, converge to the grid's
// mean coverage so that a small change of heading cannot make a line flash.
joint=mix(joint,jointDuty*(2.-jointDuty),smoothstep(.08,.65,max(cellPixel.x,cellPixel.y)))*max(surfaceY,0.);
vec3 finish=color;
float yardZ=materialPoint.z-hall.x*.5;
bool quay=yard && structure && surfaceY>.9 && materialPoint.y<.25 &&
  materialPoint.x>${bayStart}. && materialPoint.x<${bayEnd}. && abs(yardZ)<${bayHalf}.;
// Keep the tactile Outfall finish at walking distance. At long range the
// individual pours and grate teeth average into broad, stable weathering.
bool facade=structure && abs(surfaceY)<.15 && abs(outside)<3.1 && color.r<color.g*1.23;
bool walkingSurface=structure && surfaceY>.9 && color.r<color.g*1.23;
bool galleryWall=structure && outside<0. && outside>-38. && across<7. && materialPoint.y<8. && abs(surfaceY)<.15;
vec2 uv=abs(surfaceY)>.65?materialPoint.xz:(sideNormal>.7?materialPoint.zy:materialPoint.xy);
vec2 footprint=max(fwidth(uv),vec2(.002));
float pixel=max(footprint.x,footprint.y);
bool machine=yard && (!structure || surfaceKind==3);
if(machine){
 // Build the finish in the part's own coordinates so the plates, bolts and streaks
 // travel with a load. Remove each spatial frequency when it falls below a pixel.
 vec2 pitch=vec2(12.,7.5), cellId=floor(uv/pitch);
 vec2 panel=abs(fract(uv/pitch+.5)-.5)*pitch;
 float rim=min(panel.x,panel.y),plate=1.-smoothstep(.06,.16+pixel,rim);
 float wear=(noise2(uv*vec2(.052,.008))-.5)*.36;
 float close=1.-smoothstep(.7,3.2,pixel);
 finish*=1.+(.23*(hash(cellId)-.5)-.60*plate)*close+wear*(1.-smoothstep(12.,50.,pixel));
 vec2 bolt=abs(panel-vec2(.36,.33));
 float stud=ruledLine(length(bolt),.095,pixel);
 finish+=vec3(.24,.21,.14)*stud*close;
 if(!structure && abs(surfaceY)<.65){
   vec2 inset=abs(mod(uv,vec2(48.,30.))-vec2(24.,15.));
   float hatch=(1.-smoothstep(4.,4.6+pixel,inset.x))*(1.-smoothstep(2.,2.4+pixel,inset.y));
   float slat=ruledLine(abs(mod(uv.y+.24,.48)-.24),.095,footprint.y);
   finish*=1.-hatch*(.38+.42*slat)*(1.-smoothstep(1.,4.,pixel));
 }
 vec3 halfVector=normalize(normalize(eye-materialPoint-offset)+normalize(vec3(-.48,.81,-.33)));
 finish+=vec3(.18,.21,.21)*pow(max(0.,dot(faceNormal,halfVector)),22.)*direct;
}
bool floorSurface=surfaceKind==1 || surfaceKind==2;
if(floorSurface){
 // Along the trunk, station and streamed tunnel pours use the same Atlas phase.
 vec2 floorUV=plateOrigin+vec2(materialPoint.x,yardZ);
 vec2 fineUV=mod(plateOrigin+vec2(eye.x,eye.z-hall.x*.5),32.)+floorRelative;
 finish=surfaceKind==1?pouredFloor(color,floorUV,fineUV,footprint):treadFloor(color,floorUV,fineUV,footprint);
 joint=0.;
}
if((facade || (walkingSurface && !floorSurface) || galleryWall) && materialPoint.y<=hall.y){
 // Concrete filters its own frequencies. Keep its blend with the broad
 // weathering fixed in metres on the wall and floor as the camera moves.
 float close=1.-smoothstep(.035,.35,pixel);
 if(facade)close=1.-smoothstep(35.,140.,distanceM);
 if(walkingSurface)close=1.-smoothstep(12.,48.,distanceM);
 float weather=1.-smoothstep(22.,95.,pixel);
 float streak=noise2(uv*vec2(.026,facade?.0015:.018));
 finish*=1.+(.085*(streak-.5))*weather;
 if(close>0.)finish*=mix(1.,outfallConcrete(uv),close);
}
if(instrument<0. && walkingSurface && across<2. && outside<=0. && outside>-38.){
 finish=color*floorGrate(vec2(materialPoint.x-hall.z,-outside),footprint);
 joint=0.;
}
if(structure && walkingSurface && materialPoint.y<.2 && outside>0. && outside<3500.){
 // Painted service lanes taper to the four-metre socket. Transverse bands let a
 // walker gauge motion on the apron even when the distant facade hardly moves.
 float roadX=mod(materialPoint.x+${spacingM/2}.,${spacingM}.)-${spacingM/2}.;
 vec3 toLane=roadX-apronCenters;
 int lane=abs(toLane.x)<abs(toLane.y)?0:1;
 if(abs(toLane.z)<abs(toLane[lane]))lane=2;
 float track=toLane[lane],halfWidth=lane==2?${apronHalfWidthsM[3]}.:(lane==1?${apronHalfWidthsM[1]}.:${apronHalfWidthsM[0]}.);
 float kerb=ruledLine(abs(abs(track)-halfWidth+1.2),.36,footprint.x);
 float wear=1.-smoothstep(.34,1.1+footprint.x,abs(abs(mod(track+4.,8.)-4.)-1.32));
 float paving=(1.-.065*wear*(1.-smoothstep(.6,4.,footprint.x))+.18*kerb);
 finish*=mix(1.,paving,smoothstep(3.,18.,outside));
 float guide=lane==0?min(halfWidth-1.,2.6+outside*.026):halfWidth-2.;
 float edge=ruledLine(abs(abs(track)-guide),lane==2?.55:.18,pixel);
 float stripe=abs(mod(outside+12.,24.)-12.);
 float tick=ruledLine(stripe,.32,footprint.y)*(1.-smoothstep(2.,4.,abs(abs(track)-guide)));
 amberPaint=max(edge*.8,tick);
}
if(instrument<0.){
 // Service guides follow the existing deck and rails up and over the freight.
 float rail=ruledLine(abs(across-1.93),.065,footprint.x);
 float interval=abs(mod(materialPoint.z+8.,16.)-8.);
 float enamel=1.-smoothstep(.48,.85+footprint.y,interval);
 lamp=max(lamp,rail*(.16+.84*enamel)*(1.-smoothstep(.3,1.4,footprint.y)));
}
if(surfaceKind==1 && outside<=0. && materialPoint.y<.03){
 // The through-lane and its approach to the transfer crane carry the two wheel paths.
 finish=wheelWear(finish,yardZ,footprint.y);
}
if(quay){
 float walk=1.-smoothstep(10.,10.6+pixel,abs(yardZ-(${quayZ}.-10.)));
 finish=mix(finish,vec3(.30,.37,.36)*(1.+.20*(noise2(uv*.08)-.5)),walk*.75);
 float margin=ruledLine(abs(yardZ-(${quayZ}.)),.21,footprint.y);
 float warning=1.-smoothstep(1.1,1.3+footprint.x,abs(mod(materialPoint.x+.8*yardZ,7.)-3.5));
 amberPaint=max(amberPaint,max(margin,warning*(1.-smoothstep(1.4,1.6+footprint.y,abs(yardZ-(${quayZ}.+2.5))))));
 // Two paired running rails follow the existing wheel gauge through the transfer bay.
 float gauge=abs(abs(yardZ)-323.);
 finish=mix(finish,vec3(.16,.20,.21),ruledLine(gauge,5.,footprint.y)*.85);
 finish=mix(finish,vec3(.52,.56,.54),ruledLine(gauge,1.1,footprint.y));
 vec2 toLoad=abs(vec2(materialPoint.x-loadFootprint.x,yardZ))-loadFootprint.yz;
 float shadow=1.-smoothstep(0.,37.,max(toLoad.x,toLoad.y));
 finish*=1.-.44*shadow*direct;
}
if(surfaceKind==5){
 // Form-tie recesses repeat within standard panels. The much wider pour lifts
 // stay legible farther down the trench after individual board marks average out.
 vec2 form=abs(surfaceY)>.85?vec2(materialPoint.x,yardZ):
   vec2(sideNormal>.7?yardZ:materialPoint.x,materialPoint.y);
 vec2 fp=max(fwidth(form),vec2(.001));
 vec2 panel=vec2(3.6,1.8),lift=vec2(28.8,7.2);
 float batch=hash(floor(form/lift));
 vec2 fine=floorCuts(form,fp,panel,vec2(.022,.018));
 vec2 pour=floorCuts(form,fp,lift,vec2(.078,.058));
 float pixelM=max(fp.x,fp.y);
 finish=color*(1.+.09*(batch-.5)*(1.-smoothstep(.8,5.,pixelM))
     -.26*eitherStrip(fine)-.34*eitherStrip(pour));
 if(pixelM<.2){
   vec2 hole=abs(mod(form,vec2(1.8,.9))-vec2(.9,.45));
   float tie=1.-smoothstep(.020,.032+pixelM,length(hole));
   float grain=outfallConcrete(form);
   finish*=1.+(.36*(grain-1.)-.42*tie)*(1.-smoothstep(.035,.2,pixelM));
 }
 joint=0.;
}
if(surfaceKind==4){
 vec2 liningUV=vec2(sideNormal>.7?yardZ:materialPoint.x,materialPoint.y-hall.y);
 finish=plateFinish(color,liningUV,vec2(16.,8.));
 joint=0.;
}
if(structure && surfaceY>.9 && materialPoint.y>hall.y && materialPoint.y<=hall.y+${roofSlabM}.+.1){
 vec2 roofUV=plateOrigin+vec2(materialPoint.x,yardZ);
 finish=plateFinish(color,roofUV,vec2(16.,8.));
 joint=0.;
 if(yard){
   float along=mod(materialPoint.x+${spacingM/2}.,${spacingM}.)-${spacingM/2}.;
   vec2 lip=abs(vec2(along-${(bayStart+bayEnd)/2}.,yardZ))-vec2(${(bayEnd-bayStart)/2}.,${bayHalf}.);
   float rim=length(max(lip,0.))+min(max(lip.x,lip.y),0.);
   float apron=(1.-smoothstep(100.,220.+pixel,rim))*(1.-smoothstep(160.,400.,pixel));
   finish=mix(finish,vec3(.49,.42,.29),.69*apron);
   finish*=1.-.38*ruledLine(abs(rim-62.),17.,pixel);

 }
}
// Cast joints and amber inspection marks repeat in the material along ordinary wall runs.
if(yard && structure && abs(surfaceY)<.15 && abs(abs(yardZ)-${linkHalfM}.)<2.){
 float along=mod(materialPoint.x+${spacingM/2}.,${spacingM}.)-${spacingM/2}.;
 if(abs(along)>${hallHalfM}.){
   float seam=abs(mod(materialPoint.x+160.,320.)-160.);
   finish*=1.-.23*ruledLine(seam,1.2,footprint.x);
   float mark=ruledLine(abs(mod(materialPoint.x+500.,1000.)-500.),2.4,footprint.x);
   amberPaint=max(amberPaint,mark*(1.-smoothstep(1.,2.5+footprint.y,abs(materialPoint.y-8.))));
 }
}
if(facade && materialPoint.y>5.){
 vec2 m=materialPoint.xy,aa=max(fwidth(m),vec2(.05));
 vec2 slab=vec2(125.,55.),joints=filteredStrips(m/slab,max(aa,vec2(1.6))/slab,1.6/slab);
 finish*=1.-.25*max(joints.x,joints.y);
 float chevron=abs(abs(m.x-hall.z)-.38*(m.y-7.));
 float stripe=(1.-smoothstep(1.6,2.6+max(aa.x,aa.y),chevron))*smoothstep(6.,12.,m.y)*(1.-smoothstep(110.,125.,m.y));
 amberPaint=max(amberPaint,stripe);
 // The high service mark is visible across the apron. The two inset bands
 // lead the eye to the jamb and remain lit under a Shade.
 float y=m.y,markWidth=6.+.30*max(y-12.,0.);
 float mark=ruledLine(abs(across-markWidth),2.4,aa.x+.3*aa.y)
     *smoothstep(9.,18.,y)*(1.-smoothstep(156.,174.,y));
 lamp=max(lamp,mark);
}
// A facade has two skins. Vegetation takes its address from the outward skin,
// independently of which gallery or biome currently owns the camera.
float wallSide=sign(yardZ);
bool jungleFrontage=(wallSide<0.?habitats.x:habitats.y)==2.;
float wallDepth=abs(materialPoint.x)>${hallHalfM}. ? abs(yardZ)-${linkHalfM}. : outside;
if(structure && jungleFrontage && wallSide*faceNormal.z>.5 && wallDepth>=0. && wallDepth<3.1 &&
   materialPoint.y>=0. && materialPoint.y<85. && across>16.){
 vec2 wall=materialPoint.xy;
 float root=noise2(vec2(wall.x*.033,7.));
 float reach=4.+72.*root*root;
 float stem=abs(sin(wall.x*.53+1.7*sin(wall.y*.18)+noise2(wall*.12)*1.7));
 float wallPixel=max(footprint.x,footprint.y);
 float leaves=mix(smoothstep(.44,.79,noise2(wall*vec2(2.3,1.5))),.5,smoothstep(.10,.52,wallPixel));
 float cover=(1.-smoothstep(reach*.48,reach,wall.y))*(1.-smoothstep(.17,.76,stem))*(.37+.63*leaves);
 finish=mix(finish,mix(vec3(.075,.13,.065),vec3(.15,.32,.105),leaves),cover*(1.-smoothstep(.35,2.,wallPixel)));
}
finish=mix(finish,vec3(.72,.49,.22),amberPaint);
vec3 lit=finish*(1.-.24*joint)*max(workLight,.48+.52*direct);
if(structure){
 float portalGlow=exp(-across/14.-abs(outside)/21.-abs(materialPoint.y-3.)/12.);
 lit+=finish*vec3(.74,.45,.19)*portalGlow+lamp*vec3(.60,.36,.14);
 float gallery=smoothstep(0.,3.,-outside)*(1.-smoothstep(34.,43.,-outside))*
   (1.-smoothstep(5.9,7.,across))*(1.-smoothstep(7.5,9.,materialPoint.y));
 float bay=abs(mod(-outside-3.+1.9,3.8)-1.9);
 float pool=exp(-.35*abs(across-5.1)-.21*abs(5.-materialPoint.y)-.23*bay);
 lit+=gallery*finish*(vec3(.28,.52,.50)+vec3(1.55,.83,.31)*pool);
 lit=mix(lit,vec3(1.,.78,.46),fixtureLight);
}else if(machine){lit=mix(lit,vec3(1.,.78,.46),fixtureLight);}
if(roofGrid!=0)lit=ceilingLight(lit,max(workLight,.48+.52*direct),distanceM);
vec2 air=airPath(eye,materialPoint+offset);
// Mean extinction lengths in station air and exterior air are metres.
vec2 opticalDepth=distanceM*air/vec2(22000.,42000.);
vec3 indoorTint=mix(vec3(.075,.093,.11),vec3(.46,.56,.59),direct);
float airTag=1.;
${mainDepth?`
 // Main applies its own outdoor atmosphere after the station's enclosed air.
 if(linearOutput && air.y<1.)airTag=-1.-air.y;
 lit=mix(lit,indoorTint,1.-exp(-opticalDepth.x));`:`
 vec3 outdoorTint=mix(vec3(.10,.13,.18),vec3(.69,.80,.84),direct);
 float total=opticalDepth.x+opticalDepth.y;
 vec3 tint=mix(indoorTint,outdoorTint,opticalDepth.y/max(total,.00001));
 lit=mix(lit,tint,1.-exp(-total));`}
frag=vec4(frameColor(lit),airTag);
}`;

// Only the native pack paints the surrounding horizon. Meadow already has its own sky and terrain.
const skyVertex=`#version 300 es
out vec2 uv;void main(){uv=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))*2.-1.;gl_Position=vec4(uv,0.,1.);}`;
const skyFragment=`#version 300 es
precision highp float;in vec2 uv;uniform vec2 lens,landOrigin,habitat;uniform vec3 right,up,forward,eye,nearLand,farLand;uniform bool surveyed,inHall;uniform float direct,radius,mid,regionalGround,regionalAir,doorView;out vec4 frag;
uniform bool alphaMask;
${surfaceNoise}
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1)),f.x),f.y),f.z);}
float field(vec3 p){float sum=0.,amp=.5;for(int i=0;i<6;i++){
 float footprint=max(length(dFdx(p)),length(dFdy(p)));
 sum+=amp*mix(noise(p),.5,smoothstep(.35,1.3,footprint));p=p*2.07+vec3(17.1,3.8,8.4);amp*=.5;}return sum;}
void main(){
 vec3 ray=normalize(forward+right*uv.x/lens.x+up*uv.y/lens.y);float y=ray.y,h=max(.05,eye.y);
 float alpha=regionalGround<0.?1.:mix(regionalGround,regionalAir,smoothstep(-.32,-.03,y));
 if(alphaMask){frag=vec4(0.,0.,0.,alpha);return;}
 float root=sqrt(y*y+2.*h/radius),distanceM=y<0.?2.*h/(root-y):radius*(root+y);
 vec2 km=(eye.xz+ray.xz*min(distanceM,2000000.))*.001;
 float patches=.5+.24*sin(km.x*.032+sin(km.y*.021))+.16*cos(km.y*.06+km.x*.013);
 vec3 soil=mix(nearLand,farLand,smoothstep(mid*.001-1.9,mid*.001+1.9,km.y));
 vec3 ground=soil*(.72+.32*patches)*(.44+.56*direct);
 vec3 horizon=mix(vec3(.075,.093,.11),vec3(.46,.56,.59),direct);
 vec3 air=mix(vec3(.035,.045,.075),vec3(.27,.47,.62),direct);
 float haze=(1.-exp(-distanceM/42000.))*(1.-smoothstep(.035,.5,-y));
 if(surveyed){
   // Use the fixed district chart. Switching to the next station must not
   // restart a sweep of grassland or move a swale across the flight path.
   vec2 land=km+landOrigin-vec2(0.,mid*.001);
   float footprint=max(length(dFdx(land)),length(dFdy(land)));
   vec2 bend=vec2(noise2(land*.044),noise2(land*.044+32.));
   float drainage=noise2(land*vec2(.082,.19)+bend*1.9);
   float sward=clouds(land*vec2(.36,.13)+bend*3.7);
   float cover=1.-smoothstep(.27,2.4,footprint);
   float low=1.-smoothstep(.045,.19,abs(drainage-.50));
   float dry=smoothstep(.53,.79,sward);
   float edge=smoothstep(-5.8,5.8,km.y-mid*.001+(bend.y-.5)*3.);
   soil=mix(nearLand,farLand,edge);
   soil=mix(soil,vec3(.26,.29,.175),(.18+.44*dry)*cover);
   soil=mix(soil,vec3(.105,.19,.14),low*.34*cover);
   ground=soil*(.72+.34*(mix(.5,sward,cover)))*(.44+.56*direct);
   // Clear air still scatters over tens of kilometres of shallow sightline.
   haze=max(haze,.43*(1.-exp(-distanceM/34000.)));
 }
 vec3 color=mix(mix(ground,horizon,haze),air,smoothstep(0.,.65,y));
 // The shell occludes this directional view, so each opening frames its own plot.
 // Inside the enclosure, either opening can be visible. Outside it the
 // observer's own face supplies the sky even while looking along the wall.
 float face=inHall ? step(0.,ray.z) : smoothstep(-200.,200.,eye.z-mid);
 float meadow=doorView*mix(float(habitat.x==1.),float(habitat.y==1.),face);
 float jungle=doorView*mix(float(habitat.x==2.),float(habitat.y==2.),face);
 vec3 regional=color;
 if(meadow>0.){
   float skyV=clamp(y*.6+.45,0.,1.);
   vec3 sky=mix(vec3(.64,.75,.72),vec3(.18,.40,.65),skyV);
   float cloud=field(ray*7.+vec3(7,1,3));
   sky=mix(sky,vec3(.81,.84,.75),smoothstep(.53,.68,cloud)*smoothstep(-.05,.2,y)*.74);
   sky=mix(vec3(.008,.012,.021),sky,smoothstep(.015,.8,direct));
   vec3 turf=mix(vec3(.075,.13,.018),vec3(.15,.22,.046),.5)*(.03+.97*direct);
   vec3 groundAir=mix(vec3(.008,.012,.023),vec3(.58,.68,.62),smoothstep(.015,.8,direct));
   turf=mix(turf,groundAir,.82*(1.-exp(-distanceM/14000.)));
   color+=meadow*(pow(mix(turf,sky,smoothstep(175000.,420000.,distanceM)),vec3(1./2.2))-regional);
 }
 if(jungle>0.){
   vec3 jungleSky=mix(vec3(.68,.80,.83),vec3(.38,.65,.78),smoothstep(0.,.85,y));
   float heading=atan(ray.z,ray.x);
   float canopy=.006+.018*noise2(vec2(cos(heading),sin(heading))*135.);
   vec3 treeLine=mix(vec3(.09,.16,.07),vec3(.21,.32,.17),noise2(km*.5));
   vec3 jungleGround=mix(vec3(.17,.26,.12),treeLine,smoothstep(100.,2400.,distanceM));
   color+=jungle*(mix(jungleGround,jungleSky,smoothstep(canopy-.003,canopy+.003,y))*(.4+.6*direct)-regional);
 }
 // Distant sightlines share the station's clear air below the approach band.
 frag=vec4(color*alpha,alpha);
}`;
export async function prepareExteriorProgram(canvas, logDepthFarM, signal) {
  const {linkProgram} = await import('../../kit/parallel-program.mjs');
  return linkProgram(canvas.getContext('webgl2'), vertex, fragment(false, false, logDepthFarM), signal);
}
export function makeView(canvas,{capture=true,cavityBackdrop=false,district=null,shared=false,preparedProgram=null,composite=false,land=null,habitats=null,mainDepth=false,logDepthFarM=0,buildHall=stationMesh,createDoor=null,createHabitat=null,pictureDestination=null,invalidatePictures=null}={}) {
  const hand=district?rightSign(district):1;
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:composite||cavityBackdrop,preserveDrawingBuffer:capture});
  if(!gl)throw Error('The crossing view requires WebGL 2.');
  let instruments=null;
  function link(v,f){
    const p=gl.createProgram();
    for(const [type,source] of [[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]]){
      const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);
      if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));
      gl.attachShader(p,sh);gl.deleteShader(sh);
    }
    gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;
  }
  // A stand-alone station owns its depth buffer. Shared views keep their host's projection.
  const program=preparedProgram??link(vertex,fragment(mainDepth,!shared,logDepthFarM)),sky=shared?null:link(skyVertex,skyFragment);
  const locations=(p,names)=>Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(p,n)]));
  const loc=locations(program,['eye','right','up','forward','offset','focal','clip','mask','direct','workLight','hall','structure','yard','loadFootprint','habitats','logRange','airRooms[0]','airRoomCount','linearOutput','nativeDepth','plainWall','plateOrigin','plateAxes','wallAir','wallStationOffset','stationAir','foliage','nearDrain','farDrain','apronCenters']);
  const skyLoc=sky&&locations(sky,['lens','habitat','right','up','forward','eye','direct','radius','mid','nearLand','farLand','regionalGround','regionalAir','surveyed','landOrigin','doorView','inHall','alphaMask']);
  const vao=gl.createVertexArray();
  const attrs=['cornerA','cornerB','cornerC','cornerD','normal','tint'].map(n=>gl.getAttribLocation(program,n));
  const hallBuffer=gl.createBuffer(),cargoBuffer=gl.createBuffer(),wallBuffer=district?gl.createBuffer():null;
  const door=createDoor?.(gl),habitat=createHabitat?.(gl,link);
  const pictures=pictureDestination && makeMeadowDoorPictures(gl,pictureDestination,invalidatePictures);
  const bind=buffer=>{
    gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,1,gl.FLOAT,false,4,0);gl.vertexAttribDivisor(0,0);
    attrs.forEach((a,i)=>{gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,faceFloats*4,faceCorners.length*4+i*12);gl.vertexAttribDivisor(a,1);});
  };
  let wallTile=null,wallFaces=0,requestedExterior=false;
  let distant=false,fixed=0,freight=0,loaded=null,cargoKey='',uploads=0,faces=[0,0];
  let landTints=null,airRooms=null,uploadedRooms=null,roofBackdropWeight=0;
  function updateFrontages(s){
    faces=(typeof habitats==='function'?habitats(s):habitats)??[0,0];
    landTints=typeof land==='function'?land(s):land;
  }
  let plantBuffer=null,plantKey=null,plantFaces=0;
  function releasePlants(){
    if(plantBuffer)gl.deleteBuffer(plantBuffer);
    plantBuffer=null;plantKey=null;plantFaces=0;
  }
  function uploadHall(s,exteriorOnly){
      if(loaded===s && distant===exteriorOnly)return;
      door?.load(s,exteriorOnly!=='plain');
      pictures?.load(s,exteriorOnly!=='plain');
      if(loaded!==s){
        const mid=s.widthM/2,chainage=s.address.chainageM;
        const rooms=[-hallHalfM,0,hallHalfM,s.widthM];
        const visible=district?visibleStations(district,s):[];
        for(let i=0;i<visible.length;i++){
          const bay=visible[i],x=bay.x-chainage;
          if(x!==0)rooms.push(x-hallHalfM,mid-bay.widthM/2,x+hallHalfM,mid+bay.widthM/2);
          if(i>0)rooms.push(visible[i-1].x-chainage+hallHalfM,mid-linkHalfM,x-hallHalfM,mid+linkHalfM);
        }
        airRooms=new Float32Array(rooms);
      }
      let hall;
      if(exteriorOnly==='plain')hall=faceCorners;
      else if(exteriorOnly){
        const shell=mesh(true);
        districtShell(shell,s,district,true);
        hall=shell.data;
      }else hall=buildHall(s,district,true);
      releasePlants();bind(hallBuffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(hall),gl.STATIC_DRAW);
      fixed=(hall.length-faceCorners.length)/faceFloats;uploads++;
      updateFrontages(s);
      if(exteriorOnly && freight){
        bind(cargoBuffer);gl.bufferData(gl.ARRAY_BUFFER,0,gl.STATIC_DRAW);freight=0;cargoKey='';
      }
      const key=[s.traffic.lengthM,s.traffic.widthM,s.traffic.heightM].join('/');
      if(!exteriorOnly && key!==cargoKey){const car=freightMesh(s.traffic,true);freight=(car.length-faceCorners.length)/faceFloats;bind(cargoBuffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(car),gl.STATIC_DRAW);cargoKey=key;uploads++;}
      gl.bindVertexArray(null);loaded=s;distant=exteriorOnly;
    }
  let instrumentStation=null;
  function updateWall(x,z){
    if(!district)return;
    if(wallTile && Math.abs(x-wallTile.x)<=wallTile.tile/2 && Math.abs(z-wallTile.z)<=wallTile.tile/2)return;
    const shape=mesh(true),started=performance.now();
    wallTile=wallWindow(district,x,z,shape);
    bind(wallBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(shape.data),gl.DYNAMIC_DRAW);
    wallFaces=(shape.data.length-faceCorners.length)/faceFloats;uploads++;
    wallTile.buildMs=performance.now()-started;
  }
  return {
    get wall(){return wallTile && {...wallTile,faces:wallFaces,bytes:wallFaces*faceFloats*4+24,hallFaces:fixed,freightFaces:freight,lod:distant==='plain'?'wall':distant?'shell':'hall'};},
    get uploads(){return uploads;},
    get bridge(){return door?.stats;},
    get roofBackdropWeight(){return roofBackdropWeight;},
    get farPictures(){return pictures?.stats;},
    get picturePreparation(){return pictures?.preparation??null;},
    get bridgeAnimationTime(){return door?.animationTime;},
    // A cold optional view may start streaming after the station opens. Main
    // can then retire the outgoing ground and give the window the upload budget.
    get bridgePending(){return door?.pending;},
    get habitatWindow(){return habitat?.stats;},
    get habitatNeedsFrame(){return habitat?.needsFrame;},
    get bridgeError(){return door?.error;},
    retryBridge(){door?.retry();habitat?.reset();},
    refreshBridge(){if(loaded){habitat?.reset();updateFrontages(loaded);releasePlants();door?.load(loaded);pictures?.load(loaded);}},
    get drains(){return instruments;},
    get geometryBytes(){return (fixed+freight+plantFaces+wallFaces)*faceFloats*4+(Number(fixed>0)+Number(freight>0)+Number(!!plantBuffer))*faceCorners.length*4;},
    load(s,exteriorOnly=false){
      requestedExterior=exteriorOnly;
      if(district && !exteriorOnly && instrumentStation!==s){instruments=drainBank(s.address.key,localStorage);instrumentStation=s;}
    },
    dispose(){door?.dispose();habitat?.reset();pictures?.dispose();releasePlants();gl.deleteBuffer(hallBuffer);gl.deleteBuffer(cargoBuffer);if(wallBuffer)gl.deleteBuffer(wallBuffer);gl.deleteVertexArray(vao);gl.deleteProgram(program);if(sky)gl.deleteProgram(sky);
      if(composite)gl.getExtension('WEBGL_lose_context')?.loseContext();},
    draw(s,eye,yaw,pitch,time,idPass=false,direct=1,camera=null){
      const x=eye[0]+s.address.chainageM,z=eye[2]-s.widthM/2;
      const gap=Math.hypot(Math.max(0,Math.abs(eye[0])-hallHalfM),Math.max(0,Math.abs(z)-s.widthM/2));
      const level=district && gap>districtViewReachM?'plain':requestedExterior || (!!district && gap>(distant?50000:60000));
      uploadHall(s,level);updateWall(x,z);
      if(!shared){
        const scale=Math.min(1.5,window.devicePixelRatio||1),w=camera?.width??Math.max(1,Math.round(canvas.clientWidth*scale)),h=camera?.height??Math.max(1,Math.round(canvas.clientHeight*scale));
        if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      }
      const w=camera?.width??canvas.width,h=camera?.height??canvas.height,focal=camera?.focal??1.428148;
      gl.viewport(0,0,w,h);gl.disable(gl.BLEND);gl.depthMask(true);
      const co=Math.cos(yaw),si=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
      const right=camera?.right??[hand*co,0,-hand*si],up=camera?.up??[-si*sp,cp,-co*sp],forward=camera?.forward??[si*cp,sp,co*cp];
      const doorCamera=(door||habitat) && !idPass ? {eye,right,up,forward,focal:[focal*h/w,focal],width:w,height:h} : null;
      const exterior=doorCamera && door?.exterior(eye);
      const roof=!shared && doorCamera ? door?.roofWeight?.(s,eye)??0 : 0;
      let nativeDepth=false;
      if(!shared){
        gl.clearColor(0,0,0,composite||camera?.vacuum?0:1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        // A direct apron visit can begin outside the jamb. Its live Meadow view
        // fills the background, so there is no reason to shade a second sky.
        nativeDepth=!!(exterior && door.draw(doorCamera,yaw,pitch,direct,true));
        // Draw the native landscape straight into the framebuffer. Its terrain
        // depth is cleared before the station draws with its own log depth.
        const meadowWeight=roof && door.draw(doorCamera,yaw,pitch,direct,true,true) ? roof : 0;
        roofBackdropWeight=meadowWeight;
        const maskAir=meadowWeight>0 && camera?.groundWeight!=null;
        const liveHabitat=!nativeDepth && !idPass && !meadowWeight && habitat?.draw(s,doorCamera,yaw,pitch,direct,false);
        if(!liveHabitat && !nativeDepth && !idPass && (meadowWeight<1 || maskAir) && (camera?.groundWeight!==0 || camera?.airWeight>0)){
          gl.disable(gl.DEPTH_TEST);gl.useProgram(sky);gl.bindVertexArray(null);
          gl.uniform2fv(skyLoc.habitat,faces);gl.uniform2f(skyLoc.lens,focal*h/w,focal);gl.uniform3fv(skyLoc.right,right);gl.uniform3fv(skyLoc.up,up);gl.uniform3fv(skyLoc.forward,forward);
          gl.uniform3fv(skyLoc.nearLand,landTints?.[0]??[.19,.33,.15]);gl.uniform3fv(skyLoc.farLand,landTints?.[1]??[.26,.29,.25]);
          gl.uniform1f(skyLoc.radius,district?.origin.radiusM??149597870700);gl.uniform1f(skyLoc.mid,s.widthM/2);
          gl.uniform1i(skyLoc.inHall,Math.abs(eye[0])<hallHalfM && eye[1]<s.roofM && eye[2]>0 && eye[2]<s.widthM && !inFreightOpening(eye[0],z));
          const t=Math.max(0,Math.min(1,(eye[1]-s.roofM)/s.roofM));
          gl.uniform1f(skyLoc.doorView,1-t*t*(3-2*t));
          gl.uniform1i(skyLoc.surveyed,!!district);
          gl.uniform2f(skyLoc.landOrigin,s.address.chainageM*.001,0);
          gl.uniform1f(skyLoc.regionalGround,meadowWeight?-1:camera?.groundWeight??-1);
          gl.uniform1f(skyLoc.regionalAir,camera?.airWeight??0);
          gl.uniform3fv(skyLoc.eye,eye);gl.uniform1f(skyLoc.direct,direct);
          if(meadowWeight<1){
            if(meadowWeight){
              gl.enable(gl.BLEND);gl.blendColor(0,0,0,meadowWeight);
              gl.blendFuncSeparate(gl.ONE_MINUS_CONSTANT_ALPHA,gl.CONSTANT_ALPHA,gl.ONE,gl.ZERO);
            }
            gl.uniform1i(skyLoc.alphaMask,0);gl.drawArrays(gl.TRIANGLES,0,3);
          }
          if(maskAir){
            // Reveal Main's cavity sky through the same premultiplied alpha
            // mask as the district sky, without shading the landscape twice.
            gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.ZERO,gl.SRC_ALPHA,gl.ONE,gl.ZERO);
            gl.uniform1f(skyLoc.regionalGround,camera.groundWeight);
            gl.uniform1i(skyLoc.alphaMask,1);gl.drawArrays(gl.TRIANGLES,0,3);
          }
          gl.disable(gl.BLEND);
        }
      }
      if(doorCamera && !exterior && !roof){
        if(!shared && eye[2]>0 && eye[2]<s.widthM)habitat?.draw(s,doorCamera,yaw,pitch,direct,true);
        door?.draw(doorCamera,yaw,pitch,direct,false);
      }
      gl.enable(gl.DEPTH_TEST);gl.useProgram(program);
      gl.uniform1i(loc.foliage,0);
      // The adjoining terrain and the station must depth-test in the same projection.
      const usesHostDepth=shared||nativeDepth;
      const near=usesHostDepth ? (camera?.near??.05) : Math.max(.25,(eye[1]-s.roofM)*.015);
      gl.uniform2fv(loc.habitats,faces);
      if(uploadedRooms!==airRooms){
        gl.uniform1i(loc.airRoomCount,airRooms.length/4);
        gl.uniform4fv(loc['airRooms[0]'],airRooms);
        uploadedRooms=airRooms;
      }
      if(mainDepth){
        gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
        gl.uniform1f(loc.logRange,Math.log2(1+4*camera.radiusKm));
        gl.uniform1i(loc.linearOutput,camera.linear?1:0);
      }
      gl.uniform1i(loc.nativeDepth,nativeDepth);
      gl.uniform2f(loc.clip,usesHostDepth?1.00000002:1+2*near/2000000,2*near);
      const nearInstrument=Math.abs(eye[0]-s.routes[0].nearDoor[0])<85 && Math.min(Math.abs(eye[2]),Math.abs(s.widthM-eye[2]))<85;
      const phase=eye[2]<s.widthM/2?'near':'far';
      const fluid=nearInstrument && instruments ? instruments.read(phase,Date.now()/1000).levels : null;
      gl.uniform4fv(loc.nearDrain,phase==='near' && fluid ? fluid : [1,1,1,1]);
      gl.uniform4fv(loc.farDrain,phase==='far' && fluid ? fluid : [1,1,1,1]);
      gl.uniform3f(loc.apronCenters,s.routes[0].nearDoor[0],s.routes[1].nearDoor[0],s.routes[3].nearDoor[0]);
      gl.uniform3f(loc.hall,s.widthM,s.roofM,s.routes[0].nearDoor[0]);gl.uniform3fv(loc.eye,eye);gl.uniform3fv(loc.right,right);gl.uniform3fv(loc.up,up);
      gl.uniform1i(loc.yard,district?1:0);
      gl.uniform3fv(loc.forward,forward);gl.uniform2f(loc.focal,focal*h/w,focal);
      const car=freightAt(s,time);
      const nearest=car.x+Math.round((eye[0]-car.x)/car.spacingM)*car.spacingM;
      gl.uniform3f(loc.loadFootprint,nearest,car.lengthM/2,car.widthM/2);
      const inside=Math.min(1,Math.max(0,(s.roofM-eye[1])/12))*Math.min(1,Math.max(0,Math.min(eye[2]+15,s.widthM+15-eye[2])/30));
      gl.uniform1f(loc.workLight,.48+.50*inside);gl.uniform1f(loc.direct,direct);
      function drawBodies(){
        if(wallFaces){
          bind(wallBuffer);gl.uniform1i(loc.plainWall,1);gl.uniform1i(loc.mask,idPass?1:0);
          gl.uniform2fv(loc.plateOrigin,wallTile.phase);gl.uniformMatrix2fv(loc.plateAxes,false,wallTile.materialAxes);
          gl.uniform3f(loc.wallStationOffset,wallTile.x-s.address.chainageM,0,wallTile.z+s.widthM/2);
          gl.uniform1i(loc.stationAir,distant!=='plain');
          gl.uniform1f(loc.wallAir,Math.min(1,Math.max(0,outsideDistrict(district,x,z)/1000)));
          const wall=wallCamera(district,wallTile,x,z,eye[1],{right,up,forward},yaw,!camera?.forward);
          gl.uniform3fv(loc.eye,wall.eye);gl.uniform3f(loc.offset,0,0,0);
          gl.uniform3fv(loc.right,wall.right);gl.uniform3fv(loc.up,wall.up);gl.uniform3fv(loc.forward,wall.forward);
          gl.drawArraysInstanced(gl.TRIANGLES,0,6,wallFaces);
          gl.uniform1i(loc.plainWall,0);gl.uniform3fv(loc.eye,eye);
          gl.uniform3fv(loc.right,right);gl.uniform3fv(loc.up,up);gl.uniform3fv(loc.forward,forward);
        }
        if(!fixed)return;
        gl.uniform2f(loc.plateOrigin,s.address.chainageM%32000,0);
        bind(hallBuffer);gl.uniform1i(loc.mask,idPass?1:0);gl.uniform1i(loc.structure,1);
        gl.uniform3f(loc.offset,0,0,0);gl.drawArraysInstanced(gl.TRIANGLES,0,6,fixed);
        if(distant)return;
        bind(cargoBuffer);gl.uniform1i(loc.mask,idPass?2:0);gl.uniform1i(loc.structure,0);
        // Draw periodic neighbors so changing the nearest car index keeps the image continuous.
        for(const shift of [-car.spacingM,0,car.spacingM]){
          gl.uniform3f(loc.offset,nearest+shift,0,car.z);gl.drawArraysInstanced(gl.TRIANGLES,0,6,freight);
        }
      }
      const fading=camera?.opacity<1;
      if(fading){
        // Only the frontmost structure on each ray contributes to the blend.
        gl.colorMask(false,false,false,false);drawBodies();gl.colorMask(true,true,true,true);gl.depthFunc(gl.EQUAL);
        // At planetary distances several surfaces can share a depth value.
        // A stencil bit lets each covered sample receive the blend only once.
        gl.enable(gl.STENCIL_TEST);gl.stencilMask(1);gl.clearStencil(0);gl.clear(gl.STENCIL_BUFFER_BIT);
        gl.stencilFunc(gl.EQUAL,0,1);gl.stencilOp(gl.KEEP,gl.KEEP,gl.INCR);
        gl.enable(gl.BLEND);gl.blendColor(0,0,0,camera.opacity);
        gl.blendFunc(gl.CONSTANT_ALPHA,gl.ONE_MINUS_CONSTANT_ALPHA);
      }
      drawBodies();
      if(fading){gl.disable(gl.BLEND);gl.disable(gl.STENCIL_TEST);gl.stencilMask(0xff);gl.depthFunc(gl.LESS);}
      if(distant){gl.bindVertexArray(null);return;}
      const patch=!idPass && plantPatch(s,district,eye,faces);
      if(!patch){if(plantBuffer)releasePlants();}
      else{
        if(patch.key!==plantKey){
          const plants=mesh(true);growWallPlants(plants,s,district,patch);
          plantBuffer??=gl.createBuffer();bind(plantBuffer);
          gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(plants.data),gl.DYNAMIC_DRAW);
          plantFaces=(plants.data.length-faceCorners.length)/faceFloats;plantKey=patch.key;uploads++;
        }
        if(plantFaces){
          bind(plantBuffer);gl.uniform1i(loc.mask,0);gl.uniform1i(loc.foliage,1);gl.uniform3f(loc.offset,0,0,0);
          gl.drawArraysInstanced(gl.TRIANGLES,0,6,plantFaces);
        }
      }
      if(pictures&&!idPass){
        const pictureCamera={eye,right,up,forward,focal:[focal*h/w,focal],width:w,height:h,linear:camera?.linear,airRooms,
          logDepth:mainDepth?[.001,Math.log2(1+4*camera.radiusKm)]:[1,Math.log2(2000001)]};
        // A newly approached door can still be importing its live renderer.
        // Keep its last still visible for that frame.
        const handledRoute=door?.pending||door?.error?null:door?.route;
        pictures.draw(pictureCamera,yaw,pitch,direct,camera?.framebuffer??null,handledRoute);
      }
      gl.bindVertexArray(null);
    }
  };
}
