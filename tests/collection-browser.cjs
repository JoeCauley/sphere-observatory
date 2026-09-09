const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,...(process.env.SPHERE_BROWSER?{executablePath:process.env.SPHERE_BROWSER}:{})});try{
const p=await b.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.SPHERE_URL||(process.env.SPHERE_URL||'http://127.0.0.1:8766/'));await p.waitForFunction(()=>!!window.SphereCollectionUI);
const result=await p.evaluate(()=>{const A=SphereApp,M=SphereMath;A.setBusy(true);let rays=0,mismatch=0;const failures=[];
for(const shape of ['disk','square','cap','trimmed'])for(const view of ['vista','wounds','shades','station']){SphereCollectionUI.view(view,{stage:true});for(const era of ['before','after']){const s=A.getState();s.era=era;s.shadeShape=shape;s.viewMode='objectid';const w=80,h=48;A.renderer.draw(s,w,h);const gl=A.renderer.gl,pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const basis=M.basis(s.forward,s.up),ids={'Inner surface':0,Shade:1,Star:2,'Open space':3,'Stellar station':4};
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const d=M.ray((x+.5)/w*2-1,(y+.5)/h*2-1,w/h,s.fov,basis),cpu=ids[M.trace(s.position,d,s).kind],gpu=Math.round(pixels[(y*w+x)*4]/255*4);rays++;if(cpu!==gpu){mismatch++;if(failures.length<8)failures.push({shape,view,era,x,y,cpu,gpu});}}}}
SphereCollectionUI.view('vista');A.setBusy(false);return {rays,mismatch,failures,gl:A.renderer.error()};});
console.log(result);assert.equal(result.mismatch,0);assert.equal(result.gl,0);
const prior=await p.evaluate(()=>SphereApp.getState());await p.click('#eraBefore');const next=await p.evaluate(()=>SphereApp.getState());assert.deepEqual(next.position,prior.position);assert.deepEqual(next.forward,prior.forward);assert.equal(next.time,prior.time);assert.equal(next.era,'before');
await p.click('.collection-panel summary');await p.click('#advanceCycle');assert.equal((await p.evaluate(()=>SphereApp.getState())).time,prior.time+21600);
await p.click('[data-tab="camera"]');await p.locator('details').filter({hasText:'Complete scene studies'}).locator('summary').click();await p.click('#legacyStudy');assert.equal((await p.evaluate(()=>SphereApp.getState())).collection,false);
assert.deepEqual(errors,[]);console.log('PASS before/after controls, fixed camera/time, time advance, original studies and no browser errors');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
