// Camera vectors and doorway corners use the same station-local metre frame.
const minimumZ = .001;
// Tiny openings cannot resolve the movement. Larger distant openings update
// moving content once per quarter-second of its own animation clock.
export const bridgeWindTick=seconds=>Math.floor(seconds*4);
function resolvesMotion(visible) {
  return visible.areaPixels>=768 && Math.min(visible.pixelWidth,visible.pixelHeight)>=24;
}
function dot(a,b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function clipPoint(camera,x,y,z) {
  const d=[x-camera.eye[0],y-camera.eye[1],z-camera.eye[2]];
  return [dot(d,camera.right)*camera.focal[0],dot(d,camera.up)*camera.focal[1],dot(d,camera.forward),x,y,z];
}
const frustumPlanes=[
  p=>p[2]-minimumZ, p=>p[2]+p[0], p=>p[2]-p[0], p=>p[2]+p[1], p=>p[2]-p[1],
];
function clipPolygon(points,distance) {
  const out=[];
  let a=points[points.length-1],da=distance(a);
  for(const b of points) {
    const db=distance(b);
    if((da<0)!==(db<0)) {
      const t=da/(da-db);
      out.push(a.map((v,i)=>v+t*(b[i]-v)));
    }
    if(db>=0) out.push(b);
    a=b; da=db;
  }
  return out;
}

// Clipping happens before perspective division, including for a camera looking
// almost along the doorway. A centre ray can miss the entire visible sliver.
export function projectAperture(camera,aperture) {
  const {xMin,xMax,yMin,yMax,z}=aperture;
  if(!(xMax>xMin && yMax>yMin && camera.width>0 && camera.height>0)) return null;
  let points=[
    clipPoint(camera,xMin,yMin,z),clipPoint(camera,xMax,yMin,z),
    clipPoint(camera,xMax,yMax,z),clipPoint(camera,xMin,yMax,z),
  ];
  for(const plane of frustumPlanes) {
    points=clipPolygon(points,plane);
    if(points.length<3) return null;
  }
  const projected=points.map(p=>[p[0]/p[2],p[1]/p[2]]);
  let left=1,right=-1,bottom=1,top=-1,doubleArea=0;
  for(let i=0;i<projected.length;i++) {
    const [x,y]=projected[i],next=projected[(i+1)%projected.length];
    left=Math.min(left,x); right=Math.max(right,x);
    bottom=Math.min(bottom,y); top=Math.max(top,y);
    doubleArea+=x*next[1]-y*next[0];
  }
  const areaPixels=Math.abs(doubleArea)*camera.width*camera.height/8;
  if(!(areaPixels>=1)) return null;
  return {ndc:[left,bottom,right,top],points,areaPixels,
    pixelWidth:(right-left)*camera.width/2,pixelHeight:(top-bottom)*camera.height/2};
}

const vertex=`#version 300 es
precision highp float;
uniform vec4 bounds;
uniform float doorZ;
uniform vec3 eye,sourceEye;
uniform mat3 projection,sourceProjection;
uniform vec4 crop;
out vec3 texProject,relativePoint;
const vec2 corners[6]=vec2[6](vec2(0,0),vec2(1,0),vec2(1,1),vec2(0,0),vec2(1,1),vec2(0,1));
void main(){
 vec3 p=vec3(mix(bounds.xy,bounds.zw,corners[gl_VertexID]),doorZ);
 vec3 q=projection*(p-eye),s=sourceProjection*(p-sourceEye);
 relativePoint=p-eye;
 gl_Position=vec4(q.xy,q.z-.002,q.z);
 texProject=vec3((s.xy-crop.xy*s.z)/crop.zw*.5+.5*s.z,s.z);
}`;
// Match the Observatory's filmic resolve when a display-colour photograph is
// inserted into its linear lighting buffer.
export const displayToRadianceGLSL=`
vec3 displayToRadiance(vec3 authored){
 vec3 target=pow(clamp(authored,0.,1.),vec3(2.2));
 vec3 a=2.51-2.43*target,b=.03-.59*target;
 return (sqrt(b*b+.56*a*target)-b)/(2.*a)*exp2(-.2);
}`;
// The alpha channel of Main's linear buffer carries the outdoor fraction of
// the eye-to-hit ray to the atmosphere pass. Rooms are disjoint XZ rectangles.
export const indoorPathGLSL=`
uniform int airRoomCount;uniform vec4 airRooms[9];
float indoorPath(vec4 room,vec2 eyeXZ,vec2 inverseRay){
 vec2 a=(room.xy-eyeXZ-vec2(2e-6))*inverseRay,b=(room.zw-eyeXZ+vec2(2e-6))*inverseRay;
 vec2 entry=min(a,b),leave=max(a,b);
 return max(0.,min(1.,min(leave.x,leave.y))-max(0.,max(entry.x,entry.y)));
}
float indoorFraction(vec2 eyeXZ,vec2 ray){
 if(airRoomCount==0)return 0.;
 vec2 inverseRay=mix(vec2(-1.),vec2(1.),greaterThanEqual(ray,vec2(0.)))/max(abs(ray),vec2(1e-6));
 float indoors=indoorPath(airRooms[0],eyeXZ,inverseRay);
 float hitX=eyeXZ.x+ray.x;
 if(min(hitX,eyeXZ.x)<airRooms[0].x||max(hitX,eyeXZ.x)>airRooms[0].z){
   for(int i=1;i<airRoomCount;i++)indoors+=indoorPath(airRooms[i],eyeXZ,inverseRay);
 }
 return min(1.,indoors);
}`;
const fragment=depth=>`#version 300 es
precision highp float;
in vec3 texProject,relativePoint;
uniform sampler2D image;
out vec4 frag;
${depth?'uniform vec2 logDepth;uniform bool linearOutput;uniform vec3 eye;'+displayToRadianceGLSL+indoorPathGLSL:''}
void main(){
 frag=textureProj(image,texProject);
 ${depth?`if(frag.a<.5)discard;
 frag.a=1.;
 gl_FragDepth=log2(1.+length(relativePoint)*logDepth.x)/logDepth.y;
 if(linearOutput){
   frag.rgb=displayToRadiance(frag.rgb);
   float indoors=indoorFraction(eye.xz,relativePoint.xz);
   if(indoors>0.)frag.a=-1.-(1.-indoors);
 }`:''}
}
`;

function compositeProgram(gl,depth) {
  const program=gl.createProgram(),shaders=[];
  try {
    for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment(depth)]]) {
      const shader=gl.createShader(type);
      shaders.push(shader); gl.shaderSource(shader,source); gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program,shader);
    }
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    const uniforms={};
    for(const name of ['bounds','doorZ','eye','sourceEye','projection','sourceProjection','crop','image','logDepth','linearOutput','airRoomCount','airRooms[0]'])
      uniforms[name]=gl.getUniformLocation(program,name);
    return {program,uniforms};
  } catch(error) {
    gl.deleteProgram(program);
    throw error;
  } finally {
    for(const shader of shaders) gl.deleteShader(shader);
  }
}
function projection(camera) {
  const {right,up,forward,focal}=camera;
  return [0,1,2].flatMap(i=>[right[i]*focal[0],up[i]*focal[1],forward[i]]);
}
function holdCamera(camera) {
  return {...camera,eye:[...camera.eye],right:[...camera.right],up:[...camera.up],
    forward:[...camera.forward],focal:[...camera.focal]};
}
function cropFor(ndc) {
  const [left,bottom,right,top]=ndc;
  return [(right+left)/2,(top+bottom)/2,(right-left)/2,(top-bottom)/2];
}
function imageSize(visible,near) {
  const maxSide=near?1536:512,maxPixels=near?1048576:262144;
  const w=visible.pixelWidth,h=visible.pixelHeight;
  const factor=Math.min(1,maxSide/w,maxSide/h,Math.sqrt(maxPixels/(w*h)));
  // Coarse size classes avoid reallocating the target on each walking frame.
  const step=near?16:8, size=value=>Math.max(step,Math.ceil(value*factor/step)*step);
  let width=size(w),height=size(h);
  if(width*height>maxPixels) {
    if(width>height) width=step*Math.floor(maxPixels/(height*step));
    else height=step*Math.floor(maxPixels/(width*step));
  }
  return [width,height];
}
function canReuse(saved,camera,visible,revision,direct) {
  if(!saved || saved.near || saved.revision!==revision || Math.abs(saved.direct-direct)>.004) return false;
  if(visible.pixelWidth>saved.pixelWidth*1.25 || visible.pixelHeight>saved.pixelHeight*1.25) return false;
  const old=saved.camera;
  const shift=Math.hypot(...camera.eye.map((value,i)=>value-old.eye[i]));
  const scale=Math.max(camera.width*camera.focal[0],camera.height*camera.focal[1])*.5;
  for(const point of visible.points) {
    if(shift*scale>point[2]*.4) return false;
    const [sx,sy,sw]=clipPoint(old,point[3],point[4],point[5]);
    const [cx,cy,hx,hy]=saved.crop;
    if(sw<=0 || Math.abs(sx/sw-cx)>hx+1e-7 || Math.abs(sy/sw-cy)>hy+1e-7) return false;
  }
  return true;
}

// Call between the owner's background and opaque passes. Both the portal and
// native geometry are opaque in the opening. The station owns final occlusion.
export function createBridgeBiome(gl,{createProvider,depthTestPicture=false}) {
  let provider=null,composite=null,target=null,saved=null,key=null,phase='idle',nearResident=false;
  let watchedPicture=false;
  let captureCount=0,reuseCount=0,drawCount=0,releaseCount=0,directCount=0;
  function dropTarget() {
    if(target) {
      gl.deleteFramebuffer(target.framebuffer); gl.deleteTexture(target.image); gl.deleteRenderbuffer(target.depth);
      target=null;
    }
    saved=null;
  }
  function idle(retain=false) {
    if(retain && provider) { phase='held'; return; }
    if(provider || target || composite) releaseCount++;
    dropTarget(); provider?.dispose(); provider=null;
    if(composite) gl.deleteProgram(composite.program);
    composite=null; key=null; phase='idle'; nearResident=false;
  }
  function prepareTarget(w,h) {
    if(target && target.width===w && target.height===h) return;
    dropTarget();
    target={width:w,height:h,framebuffer:gl.createFramebuffer(),image:gl.createTexture(),depth:gl.createRenderbuffer()};
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,target.image);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,w,h);
    gl.bindRenderbuffer(gl.RENDERBUFFER,target.depth);
    gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);
    gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target.image,0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,target.depth);
    gl.bindRenderbuffer(gl.RENDERBUFFER,null); gl.bindTexture(gl.TEXTURE_2D,null);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw Error('Bridge picture target is incomplete');
  }
  function draw({camera,aperture,scene,direct:light,revision=0,time,windTime,near,retain=false,exterior=false,sharedExteriorDepth=false,projection:providedProjection,framebuffer=null}) {
    if(!aperture) { idle(retain); return false; }
    const visible=exterior?{ndc:[-1,-1,1,1]}:(providedProjection??projectAperture(camera,aperture));
    if(!visible) { idle(retain); return false; }
    if(key!==aperture.key) { idle(); key=aperture.key; }
    const live=near??Math.abs(camera.eye[2]-aperture.z)<=65;
    const direct=light??scene.direct??1;
    function native(ndc,width,height) {
      const crop=cropFor(ndc);
      gl.disable(gl.SCISSOR_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      gl.colorMask(true,true,true,true); gl.depthMask(true); gl.depthFunc(gl.LESS);
      gl.viewport(0,0,width,height);
      const data=typeof scene==="function"?scene():scene;
      const report=provider.draw({...data,scene:data,camera,aperture,direct,time:time??data.windTime??0,width,height,ndc,crop,near:live,retain,
        aspect:camera.width/camera.height,horizontalFov:2*Math.atan(1/camera.focal[0])*180/Math.PI});
      return {animated:report?.animated===true, tick:bridgeWindTick(data.windTime??time??0)};
    }
    try {
      provider??=createProvider(gl);
      if(live) nearResident=true;
      else if(!retain && nearResident) {
        provider.releaseNear?.(); nearResident=false;
      }
      if(exterior) {
        // Direct outdoor restores use the host framebuffer and spend no texture copy.
        gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
        native(visible.ndc,camera.width,camera.height);
        if(!sharedExteriorDepth) {
          gl.disable(gl.SCISSOR_TEST); gl.depthMask(true); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
        }
        directCount++; drawCount++; phase='live'; return true;
      }
      composite??=compositeProgram(gl,depthTestPicture);
      const reusable=!live && canReuse(saved,camera,visible,revision,direct);
      const appreciable=!live && resolvesMotion(visible) && typeof windTime==='function';
      const advanced=reusable && appreciable && saved.animated && bridgeWindTick(windTime())!==saved.tick;
      if(!reusable || advanced) {
        const [w,h]=imageSize(visible,live);
        prepareTarget(w,h);
        gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);
        gl.disable(gl.SCISSOR_TEST); gl.depthMask(true); gl.clearDepth(1);
        gl.colorMask(true,true,true,true); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        const motion=native(visible.ndc,w,h);
        saved={...motion,camera:holdCamera(camera),crop:cropFor(visible.ndc),pixelWidth:visible.pixelWidth,
          pixelHeight:visible.pixelHeight,revision,direct,near:live};
        captureCount++;
      } else reuseCount++;
      gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer); gl.viewport(0,0,camera.width,camera.height);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST);
      gl.depthMask(false); gl.colorMask(true,true,true,true);
      gl.useProgram(composite.program); gl.bindVertexArray(null);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,target.image);
      const u=composite.uniforms;
      if(depthTestPicture){
        gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);
        gl.uniform2fv(u.logDepth,camera.logDepth);gl.uniform1i(u.linearOutput,Boolean(camera.linear));
        gl.uniform1i(u.airRoomCount,(camera.airRooms?.length??0)/4);
        if(camera.airRooms?.length)gl.uniform4fv(u['airRooms[0]'],camera.airRooms);
      }
      gl.uniform4f(u.bounds,aperture.xMin,aperture.yMin,aperture.xMax,aperture.yMax);
      gl.uniform1f(u.doorZ,aperture.z); gl.uniform3fv(u.eye,camera.eye); gl.uniform3fv(u.sourceEye,saved.camera.eye);
      gl.uniformMatrix3fv(u.projection,false,projection(camera)); gl.uniformMatrix3fv(u.sourceProjection,false,projection(saved.camera));
      gl.uniform4fv(u.crop,saved.crop); gl.uniform1i(u.image,0);
      gl.drawArrays(gl.TRIANGLES,0,6);
      watchedPicture=appreciable && saved.animated;
      phase=live?'live':'picture'; drawCount++; return true;
    } catch(error) {
      idle(); throw error;
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer); gl.viewport(0,0,camera.width,camera.height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,null); gl.bindVertexArray(null);
      gl.disable(gl.SCISSOR_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.depthMask(true);
      gl.depthFunc(gl.LESS); gl.colorMask(true,true,true,true);
    }
  }
  return {draw,idle,dispose:()=>idle(),get watchWind(){return phase==='picture' && watchedPicture;},get stats(){
    return {phase,watchWind:phase==='picture' && watchedPicture,activeKey:key,captureCount,reuseCount,drawCount,releaseCount,directCount,
      width:target?.width??0,height:target?.height??0,residentBytes:target?target.width*target.height*6:0,
      provider:provider?.inspect?.()??provider?.stats??null};
  }};
}
