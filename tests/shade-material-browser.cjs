// Material filtering must be independent of what adjacent primary rays hit.
const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});
 try{
  const page=await browser.newPage();page.setDefaultTimeout(180000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SphereEvolution);await page.evaluate(()=>SphereApp.setBusy(true));
  const result=await page.evaluate(()=>{
   const R=SphereApp.renderer,gl=R.gl,M=SphereMath,source=SphereShaders.geometryFragment;
   const shared=source.slice(0,source.lastIndexOf('void main(){'));
   const fixture=SphereGLProgram(gl,SphereShaders.vertex,shared+`
uniform int fixtureMode,fixtureMask;uniform float fixtureHeight;
uniform vec3 fixtureNormal,probeRay,probeStep;uniform float probeDistance;
void main(){
 if(fixtureMode==3){fragColor=vec4(shadeSurfaceDelta(probeRay,fixtureNormal,probeDistance,probeStep),1.);return;}
 vec3 d=normalize(vec3((vUV*2.-1.)*.015,1.));shadeCameraFootprint(d,vUV*2.-1.);
 if(fixtureMode==2){
  vec2 p=vUV*vec2(6.,4.)+vec2(.371,.137),w=vec2(.14,.11);float reference=0.;
  for(int y=0;y<32;y++)for(int x=0;x<32;x++)reference+=thash(vec3(floor(p+(vec2(x,y)+.5)/32.*w-w*.5),0.))/1024.;
  fragColor=vec4(shadeDistrict(p*200000.,vec2(w.x*200000.,0.),vec2(0.,w.y*200000.),0),reference,thash(vec3(floor(p),0.)),1.);return;
 }
 if(fixtureMask==1&&mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y),2.)==0.){fragColor=vec4(0.);return;}
 float t=fixtureHeight/max(1e-6,-dot(fixtureNormal,d));vec2 uv,gx,gy;
 shadeUVFootprint(d,fixtureNormal,t,0,uv,gx,gy);
 Finish f=shadeFinishGrad(fixtureNormal,uv,3,0,gx,gy);
 fragColor=fixtureMode==0?vec4(f.normal,f.roughness):vec4(shadeSkinGrad(uv,3,t,gx,gy),f.metal);
}`);
   const w=64,h=48,texture=gl.createTexture(),fbo=gl.createFramebuffer();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
   assertFramebuffer();function assertFramebuffer(){if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Float material fixture is incomplete');}
   gl.viewport(0,0,w,h);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(fixture.p);
   const u=fixture.u;R.finishes.prepare();R.finishes.bind(u,{richMaterials:true});
   gl.uniform1i(u.uTextureDetail,1);gl.uniform1i(u.uSurfaceRelief,1);gl.uniform1i(u.uWorldTexturesReady,0);
   gl.uniform3f(u.uForward,0,0,1);gl.uniform3f(u.uRight,1,0,0);gl.uniform3f(u.uUp,0,1,0);gl.uniform1f(u.uFov,2*Math.atan(.015));gl.uniform2f(u.uResolution,w,w);gl.uniform2f(u.uRasterSize,w,h);
   const read=()=>{gl.drawArrays(gl.TRIANGLES,0,3);const p=new Float32Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.FLOAT,p);if(!p.every(Number.isFinite))throw Error('Nonfinite material output');return p;};
   const masks=[];let probeMaxRelative=0,probes=0,rawError=0,filteredError=0;
   try{
    for(const normal of [M.norm([.2,.15,-1]),M.norm([.9,.1,-.04])]){
     const right=M.norm(M.cross(normal,[0,1,0])),up=M.cross(right,normal);
     gl.uniform3fv(u.fixtureNormal,normal);gl.uniform3fv(u['uShadeUVRight[0]'],right);gl.uniform3fv(u['uShadeUVUp[0]'],up);
     for(const height of [.0005,.2,20,1e6,1e8])for(const mode of [0,1]){
      gl.uniform1f(u.fixtureHeight,height);gl.uniform1i(u.fixtureMode,mode);gl.uniform2f(u['uShadeUVAnchor[0]'],53.17,11.63);
      gl.uniform1i(u.fixtureMask,0);const full=read();gl.uniform1i(u.fixtureMask,1);const masked=read();let maxError=0,flatError=0;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)if((x+y)%2===1){const j=(y*w+x)*4;for(let c=0;c<4;c++)maxError=Math.max(maxError,Math.abs(full[j+c]-masked[j+c]));if(mode===0&&height>=1e6)for(let c=0;c<3;c++)flatError=Math.max(flatError,Math.abs(full[j+c]-normal[c]));}
      masks.push({height,mode,grazing:Math.abs(normal[2])<.1,maxError,flatError});
     }
    }
    // Independent central finite differences of ray/plane intersections.
    gl.uniform1i(u.fixtureMode,3);gl.uniform1i(u.fixtureMask,0);
    for(const height of [.002,.2,30,1e5,1e8])for(const a of [.03,.17,.43,.8]){
     const n=M.norm([.5,.13,-1]).map(Math.fround),d=M.norm([a,.07,1]).map(Math.fround),step=[.00017,-.00009,.000013].map(Math.fround),t=Math.fround(height/Math.abs(M.dot(n,d)));
     gl.uniform3fv(u.fixtureNormal,n);gl.uniform3fv(u.probeRay,d);gl.uniform3fv(u.probeStep,step);gl.uniform1f(u.probeDistance,t);
     const actual=read(),epsilon=.001,plane=t*M.dot(n,d),point=v=>M.mul(v,plane/M.dot(n,v));
     const expected=M.mul(M.sub(point(M.add(d,M.mul(step,epsilon))),point(M.sub(d,M.mul(step,epsilon)))),1/(2*epsilon));
     const error=M.length(M.sub(Array.from(actual.slice(0,3)),expected))/Math.max(1e-12,M.length(expected));probeMaxRelative=Math.max(probeMaxRelative,error);probes++;
    }
    gl.uniform1i(u.fixtureMode,2);const district=read();
    for(let i=0;i<district.length;i+=4){filteredError+=(district[i]-district[i+1])**2;rawError+=(district[i+2]-district[i+1])**2;}
    return {masks,probes,probeMaxRelative,district:{pixels:w*h,referenceSamples:w*h*1024,rawSquared:rawError,filteredSquared:filteredError},error:gl.getError()};
   }finally{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteFramebuffer(fbo);gl.deleteTexture(texture);gl.deleteProgram(fixture.p);}
  });
  const dir=path.join(__dirname,'../work/screenshots/shade-material');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(result,null,2));
  assert.equal(result.error,0);assert(result.probeMaxRelative<.00002,JSON.stringify(result));
  for(const r of result.masks){assert(r.maxError<1e-6,JSON.stringify(r));assert(r.flatError<1e-6,JSON.stringify(r));}
  assert(result.district.filteredSquared<result.district.rawSquared*.05,JSON.stringify(result.district));assert.deepEqual(errors,[]);
  console.log('PASS Shade material at mixed-object pixels, stable distant finish, finite-difference footprints and filtered districts',JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
