const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SphereLoading?.ready&&window.SphereWatershedJourney);await page.evaluate(()=>SphereApp.setBusy(true));
 const dir=path.resolve('work/screenshots/watershed');fs.mkdirSync(dir,{recursive:true});const records=[];
 for(const name of ['province','approach','garden','terrace']){
  const result=await page.evaluate(async name=>{const A=SphereApp,M=SphereMath,P=SphereWatershed,R=A.renderer;A.setState({...M.defaultState(),collection:true,era:'after'});const original=A.getState();document.getElementById('watershedArrival').value=name;document.getElementById('visitWatershed').click();while(document.getElementById('visitWatershed').disabled)await new Promise(r=>setTimeout(r,20));const s=A.getState();await R.prepare(s);const start=performance.now();do{R.draw(s,1600,900);await new Promise(r=>requestAnimationFrame(r));}while(R.needsFrame&&performance.now()-start<30000);R.draw(s,1600,900,{exportFrame:true});const png=R.canvas.toDataURL('image/png'),hit=SphereSites.trace(s.position,s.forward,s,M.trace),sample=P.sample(M.norm(hit.point),s);const saved=M.validate(M.sceneRecord(s).state);document.getElementById('returnWatershed').click();return {name,state:s,png,hit:{kind:hit.kind,distance:hit.distance},sample,groups:P.geometry(s).map(m=>({name:m.name,triangles:m.count/3})),roundTrip:JSON.stringify(saved)===JSON.stringify(M.validate(s)),returned:JSON.stringify(A.getState())===JSON.stringify(original),gl:R.error()};},name);
  fs.writeFileSync(path.join(dir,name+'.png'),Buffer.from(result.png.split(',')[1],'base64'));delete result.png;records.push(result);console.log(name,result.hit,result.gl);assert.equal(result.state.provinceRevision,1);assert.equal(result.gl,0);assert.equal(result.roundTrip,true);assert.equal(result.returned,true);assert(result.hit.kind.startsWith('Watershed'));
 }
 const depth=await page.evaluate(()=>{
  const R=SphereApp.renderer,gl=R.gl,M=SphereMath,P=SphereWatershed,w=128,h=72,results=[];
  const program=SphereGLProgram(gl,SphereShaders.vertex,`#version 300 es
precision highp float;uniform sampler2D depths;out vec4 fragColor;
void main(){fragColor=vec4(texelFetch(depths,ivec2(gl_FragCoord.xy),0).r,0.,0.,1.);}`),buffer=gl.createFramebuffer(),texture=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.bindFramebuffer(gl.FRAMEBUFFER,buffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Depth verification framebuffer unavailable');
  for(const name of ['province','approach','garden','terrace']){const s={...P.view({...M.defaultState(),collection:true,era:'after'},name),antialias:0,clouds:false,atmosphere:0,cavityHaze:0,viewMode:'material'};R.draw(s,w,h,{exportFrame:true});gl.bindFramebuffer(gl.FRAMEBUFFER,buffer);gl.viewport(0,0,w,h);gl.disable(gl.DEPTH_TEST);gl.useProgram(program.p);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,R.depthTexture);gl.uniform1i(program.u.depths,0);gl.drawArrays(gl.TRIANGLES,0,3);const pixels=new Float32Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.FLOAT,pixels);let probes=0,mismatch=0,maxError=0,subpixel=0;const failures=[],b=M.basis(s.forward,s.up);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const d=M.ray((x+.5)/w*2-1,(y+.5)/h*2-1,w/h,s.fov,b),hit=SphereSites.trace(s.position,d,s,M.trace),local=P.sample(M.norm(hit.point),s);if(!local||Math.max(Math.abs(local.x),Math.abs(local.z))>250)continue;const expected=Math.log2(1+hit.distance)/Math.log2(1+4*s.radius),error=Math.abs(expected-pixels[(y*w+x)*4]);probes++;maxError=Math.max(maxError,error);if(error>2e-7){
    // GPU rasterization snaps projected vertices to SUBPIXEL_BITS precision.
    // Compare its actual depth against the CPU depth interval over that tiny
    // footprint, including silhouettes; do not mistake raster rounding for a
    // different world address. Central-ray error is retained in the evidence.
    let lo=expected,hi=expected;const offset=2/2**gl.getParameter(gl.SUBPIXEL_BITS);
    for(const dx of [-offset,offset])for(const dy of [-offset,offset]){const ray=M.ray((x+.5+dx)/w*2-1,(y+.5+dy)/h*2-1,w/h,s.fov,b),hit=SphereSites.trace(s.position,ray,s,M.trace),depth=Math.log2(1+hit.distance)/Math.log2(1+4*s.radius);lo=Math.min(lo,depth);hi=Math.max(hi,depth);}
    const gpu=pixels[(y*w+x)*4];
    // The triangle buffers, basis and camera-relative uniforms are Float32.
    // Eight rounding operations at the contributing mesh's coordinate scale
    // bound their spatial error; convert that bound into logarithmic depth.
    // A 10 cm local acceptance margin stays well below the 2 m flight clearance.
    const meshes=P.geometry(s).filter(m=>m.name===hit.kind),mesh=meshes.sort((a,b)=>M.length(M.sub(a.origin,hit.point))-M.length(M.sub(b.origin,hit.point)))[0],bound=mesh?Math.max(1,...mesh.local(s.position).map(Math.abs),...mesh.bvh.min.map(Math.abs),...mesh.bvh.max.map(Math.abs)):320;
    const contact={};if(mesh)SphereSites.rayBVH(mesh.local(s.position),mesh.basis.map(b=>M.dot(d,b)),mesh.bvh,hit.distance+.001,contact);const cosine=contact.normal?Math.max(.0001,Math.abs(M.dot(contact.normal,mesh.basis.map(b=>M.dot(d,b))))):1;
    const tolerance=2e-7+(.0001+8*2**-23*bound)/(cosine*(1+hit.distance)*Math.log(1+4*s.radius));
    if(gpu<lo-tolerance||gpu>hi+tolerance){mismatch++;if(failures.length<5)failures.push({x,y,kind:hit.kind,distance:hit.distance,error,lo,hi,gpu});}else subpixel++;
   }}
   results.push({name,probes,mismatch,maxError,subpixel,failures});
  }gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteFramebuffer(buffer);gl.deleteTexture(texture);gl.deleteProgram(program.p);return {results,gl:R.error(),residency:P.info};
 });console.log('Live GPU depth / CPU collision',depth);fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify({records,depth,errors},null,2));assert.equal(depth.gl,0);for(const r of depth.results){assert(r.probes>1000);assert.equal(r.mismatch,0,JSON.stringify(r));}assert.deepEqual(errors,[]);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
