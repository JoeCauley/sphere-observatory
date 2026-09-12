const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereEvolution);await page.evaluate(()=>SphereApp.setBusy(true));console.log('Ready');
 const volume=await page.evaluate(()=>{
  const R=SphereApp.renderer,gl=R.gl,source=SphereVolume.march.slice(0,SphereVolume.march.indexOf('void main(){'))+`void main(){vec3 d=normalize(vec3((vUV.x*2.-1.)*.28,(vUV.y*2.-1.)*.09,1.));scattering=vec4(airDepth(d,0.,1400.),d);transmission=vec4(0.);}`;
  const fixture=SphereGLProgram(gl,SphereShaders.vertex,source),w=64,h=32,fbo=gl.createFramebuffer(),texture=gl.createTexture();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,null);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.viewport(0,0,w,h);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(fixture.p);const u=fixture.u;gl.uniform3f(u.cameraUp,0,1,0);gl.uniform1f(u.amount,1);
  const results=[];
  // Double-precision sphere/half-space clipping plus a dense independent
  // midpoint quadrature, compared with the GPU's eight-node integral.
  for(const [radius,height,offset,clip] of [[149597870.7,5,-8,1],[1e7,5,-8,1],[1e9,5,8,1],[1e7,31.99,0,0],[149597870.7,.025,-.1,1]]){
   gl.uniform1f(u.radius,radius);gl.uniform1f(u.height,height);gl.uniform4f(u.rimPlane,1,0,0,offset);gl.uniform1i(u.clipRim,clip);gl.drawArrays(gl.TRIANGLES,0,3);const pixels=new Float32Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.FLOAT,pixels);let maxError=0,rms=0,vacuum=0,wrongVacuum=0;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const v=[((x+.5)/w*2-1)*.28,((y+.5)/h*2-1)*.09,1],length=Math.hypot(...v),d=v.map(n=>n/length),r=radius-height;
    const breaks=[0,1400];for(const level of [0,32]){const b=-r*d[1],c=(level-height)*(2*radius-height-level),disc=b*b-c;if(disc>=0){const q=-b-Math.sign(b||1)*Math.sqrt(disc);for(const t of [q,c/q])if(t>0&&t<1400)breaks.push(t);}}
    if(clip&&d[0]!==0){const t=-offset/d[0];if(t>0&&t<1400)breaks.push(t);}breaks.sort((a,b)=>a-b);
    const altitude=t=>{const delta=t*t-2*r*d[1]*t;return height-delta/(Math.sqrt(r*r+delta)+r);};let expected=0;
    for(let k=1;k<breaks.length;k++){const a=breaks[k-1],b=breaks[k],mid=(a+b)*.5,H=altitude(mid);if(H<0||H>32||(clip&&d[0]*mid+offset<0))continue;let sum=0;for(let j=0;j<512;j++)sum+=Math.exp(-altitude(a+(j+.5)/512*(b-a))/7);expected+=sum*(b-a)/512/110;}
    const actual=pixels[(y*w+x)*4],error=Math.abs(actual-expected);if(!Number.isFinite(actual))throw Error('Nonfinite air column');maxError=Math.max(maxError,error);rms+=error*error;if(expected===0){vacuum++;if(actual!==0)wrongVacuum++;}
   }results.push({radius,height,offset,clip,probes:w*h,maxError,rms:Math.sqrt(rms/(w*h)),vacuum,wrongVacuum});
  }
  const error=gl.getError();gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteTexture(texture);gl.deleteFramebuffer(fbo);gl.deleteProgram(fixture.p);return {results,error};
 });console.log('Air integration',JSON.stringify(volume));assert.equal(volume.error,0);for(const r of volume.results){assert(r.maxError<.00012,JSON.stringify(r));assert.equal(r.wrongVacuum,0);}
 const coverage=await page.evaluate(()=>{
  const A=SphereApp,R=A.renderer,gl=R.gl,M=SphereMath,C=SphereCollection,src=SphereShaders.fragment,main=src.lastIndexOf('void main(){'),colour=src.indexOf('vec3 col;vec3 fill',main),tail=src.lastIndexOf(' if(uSilhouetteSamples>1&&uMode==0){');
  if(colour<0||tail<0)throw Error('Coverage fixture entry changed');
  const fixture=SphereGLProgram(gl,SphereShaders.vertex,src.slice(0,colour)+'fragColor=vec4(vec3(kind==1?1.:0.),1.);\n'+src.slice(tail)),saved={p:R.modernProgram,u:R.modernUniforms};R.modernProgram=fixture.p;R.modernUniforms=fixture.u;
  const results=[],w=96,h=72,scale=16;
  const read=(s,width,height)=>{R.draw(s,width,height,{adaptiveScale:.05});gl.bindFramebuffer(gl.FRAMEBUFFER,R.lightBuffer);const px=new Float32Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.FLOAT,px);gl.bindFramebuffer(gl.FRAMEBUFFER,null);return px;};
  try{for(const shape of ['disk','square','cap','trimmed'])for(const id of [0,7,8]){
   const s={...A.getState(),siteId:'',siteAnchor:null,shadeAttachment:null,walkMode:false,geometryDetail:false,atmosphere:0,cavityHaze:0,starStation:false,multipleWounds:false,era:'after',shadeShape:shape,antialias:0,viewMode:'material',fov:38,playing:false,time:983};
   const p=C.plates(s).find(p=>p.id===id);s.position=M.add(M.mul(p.center,s.radius),M.add(M.mul(p.normal,-s.radius*.35),M.mul(p.right,s.radius*.035)));s.forward=M.norm(M.sub(M.mul(p.center,s.radius),s.position));s.up=M.rotate(p.right,s.forward,.37);
   const raw=read(s,w,h),smooth=read({...s,antialias:3},w,h),reference=read(s,w*scale,h*scale);let rawSquared=0,smoothSquared=0,partial=0,changed=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){let expected=0;for(let sy=0;sy<scale;sy++)for(let sx=0;sx<scale;sx++)expected+=reference[((y*scale+sy)*w*scale+x*scale+sx)*4];expected/=scale*scale;const i=(y*w+x)*4;rawSquared+=(raw[i]-expected)**2;smoothSquared+=(smooth[i]-expected)**2;if(smooth[i]>0&&smooth[i]<1)partial++;if(raw[i]!==smooth[i])changed++;}
   results.push({shape,id,pixels:w*h,referenceRays:w*h*scale*scale,rawSquared,smoothSquared,partial,changed});
  }}finally{R.modernProgram=saved.p;R.modernUniforms=saved.u;gl.deleteProgram(fixture.p);}
  return {results,error:R.error()};
 });console.log('Shade coverage',JSON.stringify(coverage));assert.equal(coverage.error,0);for(const r of coverage.results){assert(r.partial>0);assert(r.smoothSquared<r.rawSquared*.5,JSON.stringify(r));}
 const perf=[];for(const id of ['rim','shade-0'])for(const antialias of [0,3]){const r=await page.evaluate(async({id,antialias})=>{const A=SphereApp,R=A.renderer;SphereEvolution.visit(id);const s={...A.getState(),antialias},times=[];await R.prepare(s);for(let j=0;j<18;j++){R.draw(s,1600,900,{adaptiveScale:.68});await new Promise(r=>setTimeout(r,24));R.pollTimers();if(j>=6&&R.gpuMs!==null)times.push(R.gpuMs);}times.sort((a,b)=>a-b);return {id,antialias,median:times[Math.floor(times.length/2)],max:times.at(-1),info:R.renderInfo,error:R.error()};},{id,antialias});perf.push(r);console.log('GPU',id,antialias,r.median,r.max);assert.equal(r.error,0);}
 const dir=path.resolve('work/screenshots/polish');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify({volume,coverage,perf,errors},null,2));assert.deepEqual(errors,[]);console.log('PASS volume accuracy, empty air, Shade subpixel coverage and preview rendering');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
