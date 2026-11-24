import {freightAt} from './station.mjs';
import {hallHalfM,linkHalfM,roofSlabM,apronRunM,rightSign,facadeRib,spacingM} from './district.mjs';
import {ribSpacing,ribs,surfaceNoise,outfallMaterials} from '../../kit/outfall-wall.mjs';
import {galleryBoxes,galleryTubes} from '../../kit/outfall-gallery.mjs';
import {bayStart,bayEnd,bayHalf,quayZ,freightBay,inFreightOpening} from './freight-bay.mjs';

const steel=[.27,.35,.36], lightSteel=[.50,.61,.60], concrete=[.38,.43,.42],
  amber=[.97,.62,.20], ballast=[.27,.30,.28], dark=[.15,.20,.22];
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

function yardRoof(m,x,mid,half,roof) {
  m.box(x-hallHalfM,x+bayStart,roof,roof+roofSlabM,mid-half,mid+half,steel);
  m.box(x+bayEnd,x+hallHalfM,roof,roof+roofSlabM,mid-half,mid+half,steel);
  m.box(x+bayStart,x+bayEnd,roof,roof+roofSlabM,mid-half,mid-bayHalf,steel);
  m.box(x+bayStart,x+bayEnd,roof,roof+roofSlabM,mid+bayHalf,mid+half,steel);
}

function yardMachinery(m,offset,mid,roof,distant=false) {
  for(const p of freightBay(roof)) {
    if(distant && p.x1-p.x0<6)continue;
    const x0=offset+p.x0,x1=offset+p.x1,z0=mid+p.z0,z1=mid+p.z1;
    if(!p.rise){m.box(x0,x1,p.y0,p.y1,z0,z1,p.color);continue;}
    const a=[x0,p.y0,z0],b=[x1,p.y0,z0],c=[x1,p.y0+p.rise,z1],d=[x0,p.y0+p.rise,z1];
    const e=[x0,p.y1,z0],f=[x1,p.y1,z0],g=[x1,p.y1+p.rise,z1],h=[x0,p.y1+p.rise,z1];
    m.quad(a,e,f,b,p.color);m.quad(b,f,g,c,p.color);m.quad(c,g,h,d,p.color);
    m.quad(d,h,e,a,p.color);m.quad(e,h,g,f,p.color);m.quad(a,b,c,d,p.color);
  }
}

function endWalls(m,x,mid,half,roof){
  for(const wall of [x-hallHalfM,x+hallHalfM]){
    m.box(wall-1,wall+1,0,roof,mid-half,mid-linkHalfM,concrete);
    m.box(wall-1,wall+1,0,roof,mid+linkHalfM,mid+half,concrete);
  }
}

export function stationMesh(s,district=null,packedFaces=false) {
  const m=mesh(packedFaces),mid=s.widthM/2,left=-hallHalfM,right=hallHalfM,heavy=s.routes[2];
  const trench=heavy.nearDoor[0],hw=heavy.door[0]/2+5;
  for(const [lo,hi] of [[left,trench-hw],[trench+hw,right]]){
    m.box(lo,hi,-12,-.08,-apronRunM,mid-s.laneHalfM,ballast);
    m.box(lo,hi,-12,0,mid-s.laneHalfM,mid+s.laneHalfM,[.42,.44,.39]);
    m.box(lo,hi,-12,-.08,mid+s.laneHalfM,s.widthM+apronRunM,ballast);
    for(const z of [-500,-325,325,500])m.box(lo,hi,0,.13,mid+z-2,mid+z+2,lightSteel);
  }
  // The deck above the underground route carries the same longitudinal freight slab.
  m.box(trench-hw,trench+hw,-24,0,mid-s.laneHalfM,mid+s.laneHalfM,concrete);
  if(district){
    yardRoof(m,0,mid,mid,s.roofM);
    endWalls(m,0,mid,mid,s.roofM);
    yardMachinery(m,0,mid,s.roofM);
  }else m.box(left,right,s.roofM,s.roofM+roofSlabM,0,s.widthM,steel);
  for(let x=left;x<=right;x+=800){
    if(district && x>bayStart && x<bayEnd){
      m.box(x-5,x+5,s.roofM-18,s.roofM,0,mid-bayHalf,lightSteel);
      m.box(x-5,x+5,s.roofM-18,s.roofM,mid+bayHalf,s.widthM,lightSteel);
    }else m.box(x-5,x+5,s.roofM-18,s.roofM,0,s.widthM,lightSteel);
    for(const z of [mid-s.laneHalfM-420,mid+s.laneHalfM+420]){
      if(district && inFreightOpening(x,z-mid))continue;
      if(s.routes.some(r=>Math.abs(r.nearDoor[0]-x)<r.deckWidthM/2+50))continue;
      m.box(x-18,x+18,0,s.roofM,z-18,z+18,concrete);
      m.box(x-20,x+20,45,49,z-20,z+20,amber);
    }
  }
  for(let z=450;z<s.widthM;z+=700){
    const spans=district && Math.abs(z-mid)<bayHalf ? [[left,bayStart],[bayEnd,right]] : [[left,right]];
    for(const [lo,hi] of spans){
      m.box(lo,hi,s.roofM-12,s.roofM,z-5,z+5,lightSteel);
      m.box(lo,hi,s.roofM-13,s.roofM-12,z-1,z+1,[1,.8,.45]);
    }
  }
  for(const r of s.routes){
    const width=r.deckWidthM/2,x=r.nearDoor[0];
    for(let i=1;i<r.points.length;i++){
      const [,ay,az]=r.points[i-1],[,by,bz]=r.points[i],depth=r.deckDepthM;
      const y0=ay+.04,y1=by+.04;
      m.quad([x-width,y0,az],[x-width,y1,bz],[x+width,y1,bz],[x+width,y0,az],r.id==='trunk'?concrete:lightSteel);
      if(depth){
        m.quad([x+width,by-depth,bz],[x-width,by-depth,bz],[x-width,ay-depth,az],[x+width,ay-depth,az],steel);
        for(const side of [-1,1]){
          const edge=x+side*width;
          m.quad([edge,y0,az],[edge,y1,bz],[edge,by-depth,bz],[edge,ay-depth,az],steel);
          if(r.id==='heavy')m.quad([edge,y0,az],[edge,y0+r.door[1],az],[edge,y1+r.door[1],bz],[edge,y1,bz],concrete);
        }
      }
      if(r.id==='service'||r.id==='carrier'){
        const gap=r.id==='service'?16:50,bar=r.id==='service'?.055:.3,railHeight=r.id==='service'?1.15:3;
        for(const side of [-1,1]){
          const edge=x+side*width;
          const bay=r.id==='service'&&side===1?s.lookout:null;
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
      m.box(x-w/2,x+w/2,h,h+1,z-2,z+2,amber);
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
    m.box(west,east,y-1.8,y+.04,near,far,lightSteel);
    for(const z of [near,far]){
      m.box(west,east,y+1.12,y+1.20,z-.05,z+.05,amber);
      for(let x=west;x<=east;x+=2.5)m.box(x-.055,x+.055,y,y+1.15,z-.055,z+.055,steel);
    }
    m.box(east-.05,east+.05,y+1.12,y+1.20,near,far,amber);
    for(let z=near;z<=far;z+=2.5)m.box(east-.055,east+.055,y,y+1.15,z-.055,z+.055,steel);
  }
  // The near and far facades use the exact same opening dimensions as the route fit check.
  for(const z of [0,s.widthM]){
    let last=left;
    for(const r of [...s.routes].sort((a,b)=>a.nearDoor[0]-b.nearDoor[0])){
      const x=r.nearDoor[0],w=r.door[0]/2;
      m.box(last,x-w,0,s.roofM,z-1,z+1,concrete);
      m.box(x-w,x+w,r.door[1],s.roofM,z-1,z+1,concrete);last=x+w;
    }
    m.box(last,right,0,s.roofM,z-1,z+1,concrete);
    if(district){
      const face=z===0?-1:1;
      const door=s.routes[0].nearDoor[0];
      const place=([x,y,depth])=>[door-face*x,y,z-face*(2+depth)];
      for(const [x,y,depth,w,h,d,tint,kind] of galleryBoxes){
        const [cx,cy,cz]=place([x,y,depth]);
        m.box(cx-w/2,cx+w/2,cy-h/2,cy+h/2,cz-d/2,cz+d/2,kind===3?[1,.88,.57]:tint);
      }
      for(const [[x,y,start],[,,end],radius,tint] of galleryTubes){
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
    m.box(fx-8,fx+8,0,.04,z-12,z+12,lightSteel);
    for(const line of [-10,10])m.box(fx-8,fx+8,.04,.065,z+line-.12,z+line+.12,amber);
    m.box(fx+8,fx+9,0,4.5,z-10,z+10,lightSteel);
  }
  if(district){
    for(let i=1;i<district.sites.length;i++){
      const start=district.sites[i-1].x+hallHalfM-s.address.chainageM;
      const end=district.sites[i].x-hallHalfM-s.address.chainageM;
      m.box(start,end,-10,0,mid-linkHalfM,mid+linkHalfM,concrete);
      m.box(start,end,s.roofM,s.roofM+roofSlabM,mid-linkHalfM,mid+linkHalfM,steel);
      for(const side of [-1,1]){
        const z=mid+side*linkHalfM;
        m.box(start,end,0,s.roofM,z-1,z+1,steel);
        m.box(start,end,1.1,1.35,z-side*2-.2,z-side*2+.2,amber);
      }
      for(const z of [-500,-325,325,500])m.box(start,end,0,.13,mid+z-2,mid+z+2,lightSteel);
    }
    for(const bay of district.sites){
      if(bay.address.key===s.address.key)continue;
      const x=bay.x-s.address.chainageM,front=mid-bay.widthM/2,back=mid+bay.widthM/2;
      m.box(x-hallHalfM,x+hallHalfM,-10,0,front,back,concrete);
      m.box(x-hallHalfM,x+hallHalfM,0,bay.roofM,front,front+2,concrete);
      m.box(x-hallHalfM,x+hallHalfM,0,bay.roofM,back-2,back,concrete);
      // End walls stop at the through freight line.
      endWalls(m,x,mid,bay.widthM/2,bay.roofM);
      yardRoof(m,x,mid,bay.widthM/2,bay.roofM);
      yardMachinery(m,x,mid,bay.roofM,true);
    }
    // The paved approach converges on the same opening in the adjoining plot.
    for(const r of s.routes.slice(0,2)){
      const x=r.nearDoor[0],w=r.door[0],k=w/4;
      for(const far of [false,true]){
        const wall=far?s.widthM:0,sign=far?1:-1;
        for(const side of [-1,1]){
          const edge=x+side*(w/2+.8*k);
          m.box(edge-.12*k,edge+.12*k,-.06,.015,wall+(far?0:-115*k),wall+(far?115*k:0),amber);
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
uniform vec3 eye,right,up,forward,offset; uniform vec2 focal,clip;
out vec3 color;out vec3 materialPoint;out float surfaceY;flat out vec3 faceNormal;flat out float fixtureLight,sideNormal;
void main(){
 vec3 position=corner<.5?cornerA:corner<1.5?cornerB:corner<2.5?cornerC:cornerD;
 vec3 d=position+offset-eye;float z=dot(d,forward);
 gl_Position=vec4(dot(d,right)*focal.x,dot(d,up)*focal.y,z*clip.x-clip.y,z);
 float lighting=.52+.28*max(normal.y,0.)+.15*abs(normal.x)+.07*max(-normal.z,0.);
 color=tint*lighting;materialPoint=position;surfaceY=normal.y;faceNormal=normal;
 fixtureLight=step(.94,tint.r)*step(.78,tint.g);
 sideNormal=abs(normal.x);
}`;
const fragment=mainDepth=>`#version 300 es
precision highp float;in vec3 color,materialPoint;in float surfaceY;flat in vec3 faceNormal;flat in float fixtureLight,sideNormal;uniform int mask;uniform bool structure;
uniform float direct,workLight; uniform vec3 airColor;uniform bool yard;uniform vec3 hall,eye,offset,loadFootprint;out vec4 frag;
${surfaceNoise}
${outfallMaterials}
float ruledLine(float d,float halfWidth,float pixel){
 return (1.-smoothstep(halfWidth,halfWidth+max(.02,pixel),d))*halfWidth/max(halfWidth,pixel);
}
${mainDepth?'uniform float logRange;uniform bool linearOutput;':''}
void main(){
${mainDepth?'gl_FragDepth=log2(1.+length(materialPoint+offset-eye)*.001)/logRange;':''}
if(mask!=0){frag=mask==2?vec4(1.,step(.65,surfaceY),step(.65,-surfaceY),1.):vec4(0.,0.,0.,1.);return;}
float distanceM=length(materialPoint+offset-eye);
float outside=max(-materialPoint.z,materialPoint.z-hall.x),across=abs(materialPoint.x-hall.z);
float amberPaint=0.,lamp=0.;
vec2 cell=materialPoint.xz/vec2(1.8,3.6),cellPixel=max(fwidth(cell),vec2(.001));
vec2 line=smoothstep(vec2(0.),min(vec2(.45),cellPixel+.012),abs(fract(cell+.5)-.5));
float joint=(1.-min(line.x,line.y))*(1.-smoothstep(.12,.65,max(cellPixel.x,cellPixel.y)))*max(surfaceY,0.);
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
bool machine=yard && (!structure || (materialPoint.x>${bayStart}. && materialPoint.x<${bayEnd}. &&
 abs(yardZ)<${bayHalf}. && materialPoint.y>.25));
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
if(facade || walkingSurface || galleryWall){
 float close=1.-smoothstep(.28,1.5,pixel);
 float weather=1.-smoothstep(22.,95.,pixel);
 float streak=noise2(uv*vec2(.026,facade?.0015:.018));
 finish*=1.+(.39*(streak-.5))*weather;
 if(close>0.)finish*=mix(1.,outfallConcrete(uv),close);
 if(walkingSurface && across<2. && materialPoint.y<hall.y && pixel<.5)
   finish*=mix(1.,outfallGrate(uv,footprint.x),1.-smoothstep(.09,.5,pixel));
}
if(structure && walkingSurface && materialPoint.y<.2 && outside>0. && outside<3500.){
 // Painted service lanes taper to the four-metre socket. Transverse bands let a
 // walker gauge motion on the apron even when the distant facade hardly moves.
 float guide=2.6+outside*.026;
 float edge=ruledLine(abs(across-guide),.18+outside*.00085,pixel);
 float stripe=abs(mod(outside+12.,24.)-12.);
 float tick=ruledLine(stripe,.32,footprint.y)*(1.-smoothstep(2.,4.,abs(across-guide)));
 amberPaint=max(edge*.8,tick);
}
if(structure && outside<=0. && across<2.25 && materialPoint.y<hall.y){
 // Service guides follow the existing deck and rails up and over the freight.
 float rail=ruledLine(abs(across-1.93),.065,footprint.x);
 float interval=abs(mod(materialPoint.z+8.,16.)-8.);
 float enamel=1.-smoothstep(.48,.85+footprint.y,interval);
 lamp=max(lamp,rail*(.16+.84*enamel)*(1.-smoothstep(.3,1.4,footprint.y)));
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
if(structure && surfaceY>.9 && materialPoint.y>hall.y && materialPoint.y<=hall.y+${roofSlabM}.+.1){
 vec2 seam=abs(fract(materialPoint.xz/vec2(7200.,3200.)+.5)-.5)*vec2(7200.,3200.);
 vec2 aa=max(fwidth(materialPoint.xz),vec2(.2));
 float strip=1.-smoothstep(45.,110.+aa.x,seam.x),band=1.-smoothstep(12.,25.+aa.y,seam.y);
 finish=mix(finish,vec3(.43,.53,.51),strip*(1.-smoothstep(600.,3000.,aa.x)));
 finish*=1.-.27*band*(1.-smoothstep(400.,1300.,aa.y));
 if(yard){
   float along=mod(materialPoint.x+${spacingM/2}.,${spacingM}.)-${spacingM/2}.;
   vec2 lip=abs(vec2(along-${(bayStart+bayEnd)/2}.,yardZ))-vec2(${(bayEnd-bayStart)/2}.,${bayHalf}.);
   float rim=length(max(lip,0.))+min(max(lip.x,lip.y),0.);
   float apron=(1.-smoothstep(100.,220.+pixel,rim))*(1.-smoothstep(160.,400.,pixel));
   finish=mix(finish,vec3(.49,.42,.29),.69*apron);
   finish*=1.-.38*ruledLine(abs(rim-62.),17.,pixel);
   float skin=1.-smoothstep(35.,145.,pixel);
   vec2 section=vec2(along,yardZ)/vec2(680.,320.);
   finish*=1.+.22*(hash(floor(section))-.5)*skin;
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
 vec2 joint=abs(fract(m/vec2(125.,55.)+.5)-.5)*vec2(125.,55.);
 finish*=1.-.25*(1.-smoothstep(0.,1.6+min(aa.x,aa.y),min(joint.x,joint.y)))*(1.-smoothstep(5.,45.,max(aa.x,aa.y)));
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
float rangeM=yard && structure && materialPoint.y>hall.y+48.?42000.:22000.;
float haze=1.-exp(-distanceM/rangeM);frag=vec4(mix(lit,airColor,haze),1.);
${mainDepth?'if(linearOutput)frag.rgb=pow(frag.rgb,vec3(2.2));':''}
}`;

// Only the native pack paints the surrounding horizon. Meadow already has its own sky and terrain.
const skyVertex=`#version 300 es
out vec2 uv;void main(){uv=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))*2.-1.;gl_Position=vec4(uv,0.,1.);}`;
const skyFragment=`#version 300 es
precision highp float;in vec2 uv;uniform vec2 lens,landOrigin;uniform vec3 right,up,forward,eye,nearLand,farLand;uniform bool surveyed;uniform float direct,radius,mid,regionalGround,regionalAir;out vec4 frag;
${surfaceNoise}
void main(){
 vec3 ray=normalize(forward+right*uv.x/lens.x+up*uv.y/lens.y);float y=ray.y,h=max(.05,eye.y);
 float root=sqrt(y*y+2.*h/radius),distanceM=y<0.?2.*h/(root-y):radius*(root+y);
 vec2 km=(eye.xz+ray.xz*min(distanceM,2000000.))*.001;
 float field=.5+.24*sin(km.x*.032+sin(km.y*.021))+.16*cos(km.y*.06+km.x*.013);
 vec3 soil=mix(nearLand,farLand,smoothstep(mid*.001-1.9,mid*.001+1.9,km.y));
 vec3 ground=soil*(.72+.32*field)*(.44+.56*direct);
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
 // Distant sightlines share the station's clear air below the approach band.
 float alpha=regionalGround<0.?1.:mix(regionalGround,regionalAir,smoothstep(-.32,-.03,y));
 frag=vec4(color*alpha,alpha);
}`;
export function makeView(canvas,{capture=true,district=null,shared=false,composite=false,land=null,mainDepth=false,buildHall=stationMesh}={}) {
  const hand=district?rightSign(district):1;
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:composite,preserveDrawingBuffer:capture});
  if(!gl)throw Error('The crossing view requires WebGL 2.');
  function link(v,f){
    const p=gl.createProgram();
    for(const [type,source] of [[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]]){
      const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);
      if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));
      gl.attachShader(p,sh);gl.deleteShader(sh);
    }
    gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;
  }
  const program=link(vertex,fragment(mainDepth)),sky=shared?null:link(skyVertex,skyFragment);
  const locations=(p,names)=>Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(p,n)]));
  const loc=locations(program,['eye','right','up','forward','offset','focal','clip','mask','direct','workLight','hall','structure','yard','loadFootprint','airColor','logRange','linearOutput']);
  const skyLoc=sky&&locations(sky,['lens','right','up','forward','eye','direct','radius','mid','nearLand','farLand','regionalGround','regionalAir','surveyed','landOrigin']);
  const vao=gl.createVertexArray();
  const attrs=['cornerA','cornerB','cornerC','cornerD','normal','tint'].map(n=>gl.getAttribLocation(program,n));
  const hallBuffer=gl.createBuffer(),cargoBuffer=gl.createBuffer();
  const bind=buffer=>{
    gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,1,gl.FLOAT,false,4,0);gl.vertexAttribDivisor(0,0);
    attrs.forEach((a,i)=>{gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,faceFloats*4,faceCorners.length*4+i*12);gl.vertexAttribDivisor(a,1);});
  };
  let fixed=0,freight=0,loaded=null,cargoKey='',uploads=0;
  return {
    get uploads(){return uploads;},
    get geometryBytes(){return (fixed+freight)*faceFloats*4+(Number(fixed>0)+Number(freight>0))*faceCorners.length*4;},
    load(s){
      if(loaded===s)return;
      const hall=buildHall(s,district,true);fixed=(hall.length-faceCorners.length)/faceFloats;bind(hallBuffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(hall),gl.STATIC_DRAW);uploads++;
      const key=[s.traffic.lengthM,s.traffic.widthM,s.traffic.heightM].join('/');
      if(key!==cargoKey){const car=freightMesh(s.traffic,true);freight=(car.length-faceCorners.length)/faceFloats;bind(cargoBuffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(car),gl.STATIC_DRAW);cargoKey=key;uploads++;}
      gl.bindVertexArray(null);loaded=s;
    },
    dispose(){gl.deleteBuffer(hallBuffer);gl.deleteBuffer(cargoBuffer);gl.deleteVertexArray(vao);gl.deleteProgram(program);if(sky)gl.deleteProgram(sky);
      if(composite)gl.getExtension('WEBGL_lose_context')?.loseContext();},
    draw(s,eye,yaw,pitch,time,idPass=false,direct=1,camera=null){
      if(!shared){
        const scale=Math.min(1.5,window.devicePixelRatio||1,camera?.maxWidth?camera.maxWidth/Math.max(1,canvas.clientWidth):Infinity),w=Math.max(1,Math.round(canvas.clientWidth*scale)),h=Math.max(1,Math.round(canvas.clientHeight*scale));
        if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      }
      const w=camera?.width??canvas.width,h=camera?.height??canvas.height,focal=camera?.focal??1.428148;
      gl.viewport(0,0,w,h);gl.disable(gl.BLEND);gl.depthMask(true);
      const co=Math.cos(yaw),si=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
      const right=camera?.right??[hand*co,0,-hand*si],up=camera?.up??[-si*sp,cp,-co*sp],forward=camera?.forward??[si*cp,sp,co*cp];
      if(!shared){
        gl.clearColor(0,0,0,composite?0:1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        if(!idPass && (camera?.groundWeight!==0 || camera?.airWeight>0)){
          gl.disable(gl.DEPTH_TEST);gl.useProgram(sky);gl.bindVertexArray(null);
          gl.uniform2f(skyLoc.lens,focal*h/w,focal);gl.uniform3fv(skyLoc.right,right);gl.uniform3fv(skyLoc.up,up);gl.uniform3fv(skyLoc.forward,forward);
          gl.uniform3fv(skyLoc.nearLand,land?.[0]??[.19,.33,.15]);gl.uniform3fv(skyLoc.farLand,land?.[1]??[.26,.29,.25]);
          gl.uniform1f(skyLoc.radius,district?.origin.radiusM??149597870700);gl.uniform1f(skyLoc.mid,s.widthM/2);
          gl.uniform1i(skyLoc.surveyed,!!district);
          gl.uniform2f(skyLoc.landOrigin,s.address.chainageM*.001,0);
          gl.uniform1f(skyLoc.regionalGround,camera?.groundWeight??-1);
          gl.uniform1f(skyLoc.regionalAir,camera?.airWeight??0);
          gl.uniform3fv(skyLoc.eye,eye);gl.uniform1f(skyLoc.direct,direct);gl.drawArrays(gl.TRIANGLES,0,3);
        }
      }
      gl.enable(gl.DEPTH_TEST);gl.useProgram(program);
      // The adjoining terrain and the station must depth-test in the same projection.
      const near=shared ? (camera?.near??.05) : Math.max(.25,(eye[1]-s.roofM)*.015);
      const daylight=Math.min(1,Math.max(0,direct));
      const horizon=shared && !mainDepth?[[.10,.13,.18],[.69,.80,.84]]:[[.075,.093,.11],[.46,.56,.59]];
      gl.uniform3fv(loc.airColor,horizon[0].map((v,i)=>v+(horizon[1][i]-v)*daylight));
      if(mainDepth){
        gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
        gl.uniform1f(loc.logRange,Math.log2(1+4*camera.radiusKm));
        gl.uniform1i(loc.linearOutput,camera.linear?1:0);
      }
      gl.uniform2f(loc.clip,shared?1.00000002:1+2*near/2000000,2*near);
      gl.uniform3f(loc.hall,s.widthM,s.roofM,s.routes[0].nearDoor[0]);gl.uniform3fv(loc.eye,eye);gl.uniform3fv(loc.right,right);gl.uniform3fv(loc.up,up);
      gl.uniform1i(loc.yard,district?1:0);
      gl.uniform3fv(loc.forward,forward);gl.uniform2f(loc.focal,focal*h/w,focal);
      const car=freightAt(s,time);
      const nearest=car.x+Math.round((eye[0]-car.x)/car.spacingM)*car.spacingM;
      gl.uniform3f(loc.loadFootprint,nearest,car.lengthM/2,car.widthM/2);
      const inside=Math.min(1,Math.max(0,(s.roofM-eye[1])/12))*Math.min(1,Math.max(0,Math.min(eye[2]+15,s.widthM+15-eye[2])/30));
      gl.uniform1f(loc.workLight,.48+.50*inside);bind(hallBuffer);gl.uniform1f(loc.direct,direct);gl.uniform1i(loc.mask,idPass?1:0);gl.uniform1i(loc.structure,1);gl.uniform3f(loc.offset,0,0,0);gl.drawArraysInstanced(gl.TRIANGLES,0,6,fixed);
      bind(cargoBuffer);gl.uniform1i(loc.structure,0);gl.uniform1i(loc.mask,idPass?2:0);
      // Draw nearby periodic neighbors too. Changing the nearest index leaves the visible scene continuous.
      for(const shift of [-car.spacingM,0,car.spacingM]){
        gl.uniform3f(loc.offset,nearest+shift,0,car.z);gl.drawArraysInstanced(gl.TRIANGLES,0,6,freight);
      }
      gl.bindVertexArray(null);
    }
  };
}
