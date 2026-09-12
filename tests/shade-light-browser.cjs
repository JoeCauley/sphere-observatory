const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.SPHERE_BROWSER?{executablePath:process.env.SPHERE_BROWSER}:{})});try{const page=await browser.newPage({viewport:{width:1200,height:850}});page.setDefaultNavigationTimeout(120000);await page.goto((process.env.SPHERE_URL||'http://127.0.0.1:8766/'));await page.waitForFunction(()=>!!window.SphereCollectionUI);
const result=await page.evaluate(()=>{const M=SphereMath,C=SphereCollection,A=SphereApp;A.setBusy(true);let probes=0,mismatch=0,lit=0,shadow=0,partial=0;const errors=[];
for(const samples of [7,19])for(const shape of ['disk','square','cap','trimmed'])for(const hour of [0,8,12]){
 const s={...M.defaultState(),layoutVersion:1,collection:true,era:'before',shadeShape:shape,time:hour*3600,shadowSamples:samples,starStation:false,viewMode:'lightid',fov:100};const pl=C.plates(s).find(p=>p.id===16);
 s.position=M.mul(M.add(M.mul(pl.normal,.70),M.mul(pl.right,.25)),s.radius);s.forward=M.norm(M.sub(M.mul(pl.center,s.radius),s.position));s.up=M.basis(s.forward,pl.right).u;
 const w=96,h=64;A.renderer.draw(s,w,h);const gl=A.renderer.gl,pix=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pix);const b=M.basis(s.forward,s.up),pn=M.mul(s.position,1/s.radius);
 for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){const ray=M.ray((x+.5)/w*2-1,(y+.5)/h*2-1,w/h,s.fov,b);if(M.trace(s.position,ray,s).kind!=='Shade')continue;
 let t=Infinity,hitPlate;for(const p of C.plates(s)){const d=C.diskDistance(pn,ray,p);if(d<t){t=d;hitPlate=p;}}
 const hit=M.add(pn,M.mul(ray,t)),normal=(shape==='cap'||shape==='trimmed')?M.norm(hit):hitPlate.normal;if(M.dot(ray,normal)<=0)continue;
 const cpu=C.visibility(M.mul(hit,s.radius),s,samples,hitPlate.id),gpu=pix[(y*w+x)*4]/255;probes++;if(cpu===0)shadow++;else if(cpu===1)lit++;else partial++;
 if(Math.abs(cpu-gpu)>.01){mismatch++;if(errors.length<6)errors.push({shape,hour,cpu,gpu,x,y});}
 }}A.setBusy(false);return {probes,mismatch,lit,shadow,partial,errors};});console.log(JSON.stringify(result));assert.equal(result.mismatch,0);assert(result.lit>0&&result.shadow>0&&result.partial>0);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
