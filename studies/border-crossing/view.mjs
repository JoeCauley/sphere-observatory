import {freightAt} from './station.mjs';

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

export function stationMesh(s) {
  const m=mesh(),mid=s.widthM/2,left=-16000,right=16000,heavy=s.routes[2];
  const trench=heavy.nearDoor[0],hw=heavy.door[0]/2+5;
  for(const [lo,hi] of [[left,trench-hw],[trench+hw,right]]){
    m.box(lo,hi,-12,-.08,-3500,s.widthM+3500,ballast);
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
        m.box(edge-.24,edge+.24,0,h,z-1,z+1,amber);
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
uniform vec3 eye,right,up,forward,offset; uniform vec2 focal;
out vec3 color; out float distanceM;out float surfaceY;
void main(){
 vec3 d=position+offset-eye;float z=dot(d,forward);
 gl_Position=vec4(dot(d,right)*focal.x,dot(d,up)*focal.y,z*1.000004-.500001,z);
 float lighting=.52+.28*max(normal.y,0.)+.15*abs(normal.x)+.07*max(-normal.z,0.);
 color=tint*lighting;distanceM=length(d);surfaceY=normal.y;
}`;
const fragment=`#version 300 es
precision highp float; in vec3 color; in float distanceM,surfaceY;uniform int mask;out vec4 frag;
void main(){if(mask!=0){frag=mask==2?vec4(1.,step(.65,surfaceY),step(.65,-surfaceY),1.):vec4(0.,0.,0.,1.);return;}
float haze=1.-exp(-distanceM/22000.);frag=vec4(mix(color,vec3(.27,.34,.35),haze),1.);}`;

export function makeView(canvas) {
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});
  if(!gl)throw Error('The crossing view requires WebGL 2.');
  const program=gl.createProgram();
  for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
    const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);
    if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));
    gl.attachShader(program,sh);gl.deleteShader(sh);
  }
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const loc=Object.fromEntries(['eye','right','up','forward','offset','focal','mask'].map(n=>[n,gl.getUniformLocation(program,n)]));
  const attrs=['position','normal','tint'].map(n=>gl.getAttribLocation(program,n));
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  attrs.forEach((a,i)=>{gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,36,i*12);});
  let fixed=0,freight=0;
  return {
    load(s){const hall=stationMesh(s),car=freightMesh(s.traffic);
      fixed=hall.length/9;freight=car.length/9;gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(hall.concat(car)),gl.STATIC_DRAW);},
    draw(s,eye,yaw,pitch,time,idPass=false){
      const scale=Math.min(1.5,window.devicePixelRatio||1),w=Math.max(1,Math.round(canvas.clientWidth*scale)),h=Math.max(1,Math.round(canvas.clientHeight*scale));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      gl.viewport(0,0,w,h);if(idPass)gl.clearColor(0,0,0,1);else gl.clearColor(.27,.34,.35,1);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);
      const co=Math.cos(yaw),si=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
      gl.uniform3fv(loc.eye,eye);gl.uniform3f(loc.right,co,0,-si);gl.uniform3f(loc.up,-si*sp,cp,-co*sp);
      gl.uniform3f(loc.forward,si*cp,sp,co*cp);gl.uniform2f(loc.focal,1.35*h/w,1.35);
      gl.uniform1i(loc.mask,idPass?1:0);gl.uniform3f(loc.offset,0,0,0);gl.drawArrays(gl.TRIANGLES,0,fixed);
      const car=freightAt(s,time);
      gl.uniform1i(loc.mask,idPass?2:0);
      // Draw nearby periodic neighbors too. Changing the nearest index leaves the visible scene continuous.
      for(const shift of [-car.spacingM,0,car.spacingM]){
        gl.uniform3f(loc.offset,car.x+shift,0,car.z);gl.drawArrays(gl.TRIANGLES,fixed,freight);
      }
    }
  };
}
