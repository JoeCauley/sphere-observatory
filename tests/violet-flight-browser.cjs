'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {session,executable}=require('./support/biome-browser.cjs');

async function main(){
  const host=await session(),browser=await chromium.launch({executablePath:executable(),headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1240,height:800}});
    await host.attach(context);
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(360000);
    await page.goto(host.origin,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready && window.SphereBiomeLibrary?.world,null,{polling:200});
    await page.evaluate(async()=>{
      const s=SphereApp.getState();s.seed=713;s.playing=false;SphereApp.setState(s);
      await SphereBiomeLibrary.selectWorld();await SphereBiomeLibrary.install('border-outfall');
    });
    await page.waitForFunction(()=>SphereBiomeSurface.inspect().status==='ready' && SphereLoading.ready,null,{polling:200});
    const result=await page.evaluate(async()=>{
      SphereApp.setBusy(true);
      const r=SphereApp.renderer,M=SphereMath,s=await SpherePlaces.destination(SphereApp.getState(),'biome-9','ground');
      const q=M.norm(s.position),basis=SphereSites.shellFrame(q),t=M.norm(M.add(M.mul(basis[0],.65),M.mul(basis[2],.76)));
      s.position=M.mul(q,s.radius-11.355);s.forward=M.norm(M.add(t,M.mul(q,.046)));s.up=M.basis(s.forward,M.mul(q,-1)).u;
      s.walkMode=false;s.walkPosition=null;s.walkVelocity=0;s.playing=false;
      const width=1056,height=640;
      await r.prepare(s,{aspect:width/height});
      const nativeBind=r.heroes.bind,photos={},weights={};
      try{
        for(const phase of ['loading','settled']){
          // Reproduce a freshly uploaded map and a settled map at precisely the same address.
          let shellWeight;
          r.heroes.bind=function(u,exact){
            if(u===r.uniforms)this.loadedAt[9]=performance.now()-(phase==='settled'?1000:0);
            nativeBind.call(this,u,exact);
            if(u===r.uniforms)shellWeight=this.ready[9];
          };
          r.draw(s,width,height);
          weights[phase]=[shellWeight,r.heroes.ready[9]];
          photos[phase]=r.canvas.toDataURL('image/jpeg',.94).split(',')[1];
        }
        return {photos,weights,chunks:SphereGround.info.chunks,queue:SphereGround.info.queue,glError:r.gl.getError(),
          lost:r.gl.isContextLost(),site:s.siteId,heightKm:s.radius-M.length(s.position)};
      }finally{r.heroes.bind=nativeBind;SphereApp.setBusy(false);}
    });
    assert.deepEqual(errors,[]);assert.equal(result.glError,0);assert.equal(result.lost,false);
    assert.equal(result.site,'biome-9');assert(Math.abs(result.heightKm-11.355)<.0001);
    assert.equal(result.chunks,25);assert.equal(result.queue,0);
    const [first,second]=result.weights.loading;assert(first<.1 && first===second,'Shell and mesh first-frame artwork weights diverged: '+[first,second]);
    assert.deepEqual(result.weights.settled,[1,1]);
    if(process.env.SPHERE_VIOLET_OUTPUT){
      const dir=process.env.SPHERE_VIOLET_OUTPUT;fs.mkdirSync(dir,{recursive:true});
      for(const [name,photo] of Object.entries(result.photos))fs.writeFileSync(path.join(dir,name+'.jpg'),Buffer.from(photo,'base64'));
    }
    console.log('PASS Violet Labyrinth at 11.355 km, 25 connected tiles, identical shell and mesh artwork through loading and settled flight',result.weights);
  }finally{await browser.close();await host.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
