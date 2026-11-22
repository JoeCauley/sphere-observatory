import {freightAt} from './station.mjs';
import {hallHalfM,linkHalfM,roofSlabM,apronRunM,rightSign} from './district.mjs';

const steel=[.27,.35,.36], lightSteel=[.50,.61,.60], concrete=[.38,.43,.42],
  amber=[.97,.62,.20], ballast=[.27,.30,.28], dark=[.15,.20,.22];
function mesh() {
  const data=[];
  const quad=(a,b,c,d,col)=>{
    const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const length=Math.hypot(...n)||1;
    for(const p of [a,b,c,a,c,d])data.push(...p,...n.map(x=>x/length),...col);
  };
  const box=(x0,x1,y0,y1,z0,z1,col)=>{
    if(x1<=x0||y1<=y0||z1<=z0)return;
    const a=[x0,y0,z0],b=[x1,y0,z0],c=[x1,y0,z1],d=[x0,y0,z1],
      e=[x0,y1,z0],f=[x1,y1,z0],g=[x1,y1,z1],h=[x0,y1,z1];
    quad(a,e,f,b,col);quad(b,f,g,c,col);quad(c,g,h,d,col);quad(d,h,e,a,col);
    quad(e,h,g,f,col);quad(a,b,c,d,col);
  };
  return {data,quad,box};
}

export function stationMesh(s,district=null) {
  const m=mesh(),mid=s.widthM/2,left=-hallHalfM,right=hallHalfM,heavy=s.routes[2];
  const trench=heavy.nearDoor[0],hw=heavy.door[0]/2+5;
  for(const [lo,hi] of [[left,trench-hw],[trench+hw,right]]){
    m.box(lo,hi,-12,-.08,-apronRunM,s.widthM+apronRunM,ballast);
    m.box(lo,hi,-.08,0,mid-s.laneHalfM,mid+s.laneHalfM,[.42,.44,.39]);
    for(const z of [-500,-325,325,500])m.box(lo,hi,0,.13,mid+z-2,mid+z+2,lightSteel);
  }
  // The deck above the underground route carries the same longitudinal freight slab.
  m.box(trench-hw,trench+hw,-24,0,mid-s.laneHalfM,mid+s.laneHalfM,concrete);
  m.box(left,right,s.roofM,s.roofM+45,0,s.widthM,steel);
  for(let x=left;x<=right;x+=800){
    m.box(x-5,x+5,s.roofM-18,s.roofM,0,s.widthM,lightSteel);
    for(const z of [mid-s.laneHalfM-420,mid+s.laneHalfM+420]){
      if(s.routes.some(r=>Math.abs(r.nearDoor[0]-x)<r.deckWidthM/2+50))continue;
      m.box(x-18,x+18,0,s.roofM,z-18,z+18,concrete);
      m.box(x-20,x+20,45,49,z-20,z+20,amber);
    }
  }
  for(let z=450;z<s.widthM;z+=700){
    m.box(left,right,s.roofM-12,s.roofM,z-5,z+5,lightSteel);
    m.box(left,right,s.roofM-13,s.roofM-12,z-1,z+1,[1,.8,.45]);
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
  }
  const fx=s.floorRoute.points[2][0];
  for(const sign of [-1,1]){
    const z=mid+sign*(s.laneHalfM+60);
    m.box(fx-8,fx+8,0,.04,z-12,z+12,lightSteel);
    for(const line of [-10,10])m.box(fx-8,fx+8,.04,.065,z+line-.12,z+line+.12,amber);
    m.box(fx+8,fx+9,0,4.5,z-10,z+10,lightSteel);
  }
  if(district){
    const first=district.sites[0].x-s.address.chainageM,last=district.sites.at(-1).x-s.address.chainageM;
    for(const [start,end] of [[first,left],[right,last]]){
      if(end<=start)continue;
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
      m.box(x-hallHalfM,x+hallHalfM,0,bay.roofM,front,back,concrete);
      m.box(x-hallHalfM,x+hallHalfM,bay.roofM,bay.roofM+roofSlabM,front,back,steel);
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

export function freightMesh(t) {
  const m=mesh(),l=t.lengthM/2,w=t.widthM/2;
  m.box(-l,l,12,52,-w,w,dark);m.box(-l+6,l-6,48,63,-w,w,amber);
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
  }
  return m.data;
}

const vertex=`#version 300 es
in vec3 position,normal,tint;
uniform vec3 eye,right,up,forward,offset; uniform vec2 focal,clip;
out vec3 color;out vec3 materialPoint;out float distanceM;out float surfaceY;
void main(){
 vec3 d=position+offset-eye;float z=dot(d,forward);
 gl_Position=vec4(dot(d,right)*focal.x,dot(d,up)*focal.y,z*clip.x-clip.y,z);
 float lighting=.52+.28*max(normal.y,0.)+.15*abs(normal.x)+.07*max(-normal.z,0.);
 color=tint*lighting;materialPoint=position;distanceM=length(d);surfaceY=normal.y;
}`;
const fragment=`#version 300 es
precision highp float;in vec3 color,materialPoint;in float distanceM,surfaceY;uniform int mask;uniform float direct,workLight;uniform vec3 hall;out vec4 frag;
void main(){if(mask!=0){frag=mask==2?vec4(1.,step(.65,surfaceY),step(.65,-surfaceY),1.):vec4(0.,0.,0.,1.);return;}
vec2 cell=materialPoint.xz/vec2(1.8,3.6),pixel=max(fwidth(cell),vec2(.001));
vec2 line=smoothstep(vec2(0.),min(vec2(.45),pixel+.012),abs(fract(cell+.5)-.5));
float joint=(1.-min(line.x,line.y))*(1.-smoothstep(.12,.65,max(pixel.x,pixel.y)))*max(surfaceY,0.);
vec3 finish=color;
if(surfaceY>.9 && materialPoint.y>hall.y){
 vec2 seam=abs(fract(materialPoint.xz/vec2(7200.,3200.)+.5)-.5)*vec2(7200.,3200.);
 vec2 aa=max(fwidth(materialPoint.xz),vec2(.2));
 float strip=1.-smoothstep(45.,110.+aa.x,seam.x),band=1.-smoothstep(12.,25.+aa.y,seam.y);
 finish=mix(finish,vec3(.43,.53,.51),strip*(1.-smoothstep(600.,3000.,aa.x)));
 finish*=1.-.27*band*(1.-smoothstep(400.,1300.,aa.y));
}
if(abs(surfaceY)<.1 && min(abs(materialPoint.z),abs(materialPoint.z-hall.x))<1.01 && materialPoint.y>5.){
 vec2 m=materialPoint.xy,aa=max(fwidth(m),vec2(.05));
 vec2 joint=abs(fract(m/vec2(125.,55.)+.5)-.5)*vec2(125.,55.);
 finish*=1.-.25*(1.-smoothstep(0.,1.6+min(aa.x,aa.y),min(joint.x,joint.y)))*(1.-smoothstep(5.,45.,max(aa.x,aa.y)));
 float chevron=abs(abs(m.x-hall.z)-.38*(m.y-7.));
 float stripe=(1.-smoothstep(1.6,2.6+max(aa.x,aa.y),chevron))*smoothstep(6.,12.,m.y)*(1.-smoothstep(110.,125.,m.y));
 finish=mix(finish,vec3(.73,.48,.16),stripe);
}
vec3 lit=finish*(1.-.24*joint)*max(workLight,.48+.52*direct);
float haze=1.-exp(-distanceM/22000.);frag=vec4(mix(lit,vec3(.27,.34,.35)*max(workLight,.48+.52*direct),haze),1.);}`;

// Only the native pack paints the surrounding horizon. Meadow already has its own sky and terrain.
const skyVertex=`#version 300 es
out vec2 uv;void main(){uv=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))*2.-1.;gl_Position=vec4(uv,0.,1.);}`;
const skyFragment=`#version 300 es
precision highp float;in vec2 uv;uniform vec2 lens;uniform vec3 right,up,forward,eye,nearLand,farLand;uniform float direct,radius,mid,regionalGround;out vec4 frag;
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
 vec3 color=mix(mix(ground,horizon,haze),air,smoothstep(0.,.65,y));
 // Only downward rays in the regional image replace the distant ground. Keep the real cavity sky above them.
 float alpha=regionalGround<0.?1.:regionalGround*(1.-smoothstep(-.32,-.03,y));
 frag=vec4(color*alpha,alpha);
}`;
export function makeView(canvas,{capture=true,district=null,shared=false,composite=false,land=null}={}) {
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
  const program=link(vertex,fragment),sky=shared?null:link(skyVertex,skyFragment);
  const locations=(p,names)=>Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(p,n)]));
  const loc=locations(program,['eye','right','up','forward','offset','focal','clip','mask','direct','workLight','hall']);
  const skyLoc=sky&&locations(sky,['lens','right','up','forward','eye','direct','radius','mid','nearLand','farLand','regionalGround']);
  const vao=gl.createVertexArray();
  const attrs=['position','normal','tint'].map(n=>gl.getAttribLocation(program,n));
  const hallBuffer=gl.createBuffer(),cargoBuffer=gl.createBuffer();
  const bind=buffer=>{
    gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    attrs.forEach((a,i)=>{gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,36,i*12);});
  };
  let fixed=0,freight=0,loaded=null,cargoKey='',uploads=0;
  return {
    get uploads(){return uploads;},
    load(s){
      if(loaded===s)return;
      const hall=stationMesh(s,district);fixed=hall.length/9;bind(hallBuffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(hall),gl.STATIC_DRAW);uploads++;
      const key=[s.traffic.lengthM,s.traffic.widthM,s.traffic.heightM].join('/');
      if(key!==cargoKey){const car=freightMesh(s.traffic);freight=car.length/9;bind(cargoBuffer);
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
      const w=canvas.width,h=canvas.height,focal=camera?.focal??1.428148;
      gl.viewport(0,0,w,h);gl.disable(gl.BLEND);gl.depthMask(true);
      const co=Math.cos(yaw),si=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
      const right=camera?.right??[hand*co,0,-hand*si],up=camera?.up??[-si*sp,cp,-co*sp],forward=camera?.forward??[si*cp,sp,co*cp];
      if(!shared){
        gl.clearColor(0,0,0,composite?0:1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        if(!idPass && camera?.groundWeight!==0){
          gl.disable(gl.DEPTH_TEST);gl.useProgram(sky);gl.bindVertexArray(null);
          gl.uniform2f(skyLoc.lens,focal*h/w,focal);gl.uniform3fv(skyLoc.right,right);gl.uniform3fv(skyLoc.up,up);gl.uniform3fv(skyLoc.forward,forward);
          gl.uniform3fv(skyLoc.nearLand,land?.[0]??[.19,.33,.15]);gl.uniform3fv(skyLoc.farLand,land?.[1]??[.26,.29,.25]);
          gl.uniform1f(skyLoc.radius,district?.origin.radiusM??149597870700);gl.uniform1f(skyLoc.mid,s.widthM/2);
          gl.uniform1f(skyLoc.regionalGround,camera?.groundWeight??-1);
          gl.uniform3fv(skyLoc.eye,eye);gl.uniform1f(skyLoc.direct,direct);gl.drawArrays(gl.TRIANGLES,0,3);
        }
      }
      gl.enable(gl.DEPTH_TEST);gl.useProgram(program);
      // The adjoining terrain and the station must depth-test in the same projection.
      const near=shared ? .05 : Math.max(.25,(eye[1]-s.roofM)*.015);
      gl.uniform2f(loc.clip,shared?1.00000002:1+2*near/2000000,2*near);
      gl.uniform3f(loc.hall,s.widthM,s.roofM,s.routes[0].nearDoor[0]);gl.uniform3fv(loc.eye,eye);gl.uniform3fv(loc.right,right);gl.uniform3fv(loc.up,up);
      gl.uniform3fv(loc.forward,forward);gl.uniform2f(loc.focal,focal*h/w,focal);
      const inside=Math.min(1,Math.max(0,(s.roofM-eye[1])/12))*Math.min(1,Math.max(0,Math.min(eye[2]+15,s.widthM+15-eye[2])/30));
      gl.uniform1f(loc.workLight,.48+.50*inside);bind(hallBuffer);gl.uniform1f(loc.direct,direct);gl.uniform1i(loc.mask,idPass?1:0);gl.uniform3f(loc.offset,0,0,0);gl.drawArrays(gl.TRIANGLES,0,fixed);
      const car=freightAt(s,time);
      bind(cargoBuffer);gl.uniform1i(loc.mask,idPass?2:0);
      const nearest=car.x+Math.round((eye[0]-car.x)/car.spacingM)*car.spacingM;
      // Draw nearby periodic neighbors too. Changing the nearest index leaves the visible scene continuous.
      for(const shift of [-car.spacingM,0,car.spacingM]){
        gl.uniform3f(loc.offset,nearest+shift,0,car.z);gl.drawArrays(gl.TRIANGLES,0,freight);
      }
      gl.bindVertexArray(null);
    }
  };
}
