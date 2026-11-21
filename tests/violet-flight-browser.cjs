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
    const habitatRequests=[];
    page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/assets/biomes/'))habitatRequests.push(r.url());});
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
    assert.deepEqual(habitatRequests,[],'Procedural habitats must not request stock artwork');
    assert.deepEqual(result.weights.loading,result.weights.settled);
    const grove=await page.evaluate(async()=>{
      SphereApp.setBusy(true);
      try{
        const r=SphereApp.renderer,M=SphereMath,G=SphereGround;
        const s=await SpherePlaces.destination(SphereApp.getState(),'biome-9','ground');
        s.walkMode=false;s.playing=false;s.time=0;s.routeShades=true;
        const f=G.frame(s),grove=SphereVioletForest.referenceGrove(s);
        s.position=f.world([0,.04,0]);await r.prepare(s,{aspect:1.65});
        const floor=G.ground(s,0,0);s.position=f.world([0,floor+SphereSites.EYE,0]);
        const targets=grove.spires.map(tree=>({tree,p:f.local(M.mul(tree.q,s.radius))}))
          .filter(({tree,p})=>tree.height>.085 && Math.hypot(p[0],p[2])>.12).sort((a,b)=>Math.hypot(a.p[0],a.p[2])-Math.hypot(b.p[0],b.p[2]));
        const {tree,p}=targets[0],look=f.world([p[0],floor+tree.height*.32,p[2]]);
        s.forward=M.norm(M.sub(look,s.position));s.up=M.basis(s.forward,f.basis[1]).u;
        const snapshot=SphereSessionCodec.decode(SphereSessionCodec.encode(s,{})).state;
        const ids=G.neighbourhood(s).flatMap(t=>t.ground.props??[]).filter(v=>String(v).includes('/reference/'));
        const visibility=t=>SphereCollection.visibility(s.position,{...s,time:t},64);
        let clear,dark;
        for(let t=0;t<=2000000 && (clear===undefined||dark===undefined);t+=120){
          const light=visibility(t);if(light>.9 && clear===undefined)clear=t;if(light===0 && dark===undefined)dark=t;
        }
        const shots={};
        for(const [label,time] of [['forest',clear],['forest-shade',dark]]){
          if(time===undefined)continue;s.time=time;r.draw(s,1056,640);
          shots[label]=r.canvas.toDataURL('image/jpeg',.92).split(',')[1];
        }
        return {shots,dark,clear,ids:ids.length,selected:ids.includes(tree.id),tree:tree.id,height:tree.height,bytes:G.info.bytes,
          restored:Math.hypot(...snapshot.position.map((v,i)=>v-s.position[i])),error:r.gl.getError()};
      }finally{SphereApp.setBusy(false);}
    });
    assert(grove.selected && grove.ids>250);assert(grove.restored<.000001);assert.equal(grove.error,0);
    assert(grove.clear!==undefined && grove.dark!==undefined);assert.notEqual(grove.shots.forest,grove.shots['forest-shade']);
    Object.assign(result.photos,grove.shots);
    console.log('PASS eye-level seeded forest, selected crown',grove.tree,'height',Math.round(grove.height*1000),'m, clear and fully shaded views, saved pose and resident bytes',grove.bytes);
    if(process.env.SPHERE_VIOLET_OUTPUT){
      const dir=process.env.SPHERE_VIOLET_OUTPUT;fs.mkdirSync(dir,{recursive:true});
      for(const [name,photo] of Object.entries(result.photos))fs.writeFileSync(path.join(dir,name+'.jpg'),Buffer.from(photo,'base64'));
    }
    console.log('PASS Violet Labyrinth at 11.355 km, 25 connected tiles, procedural shell and mesh without stock image requests',result.weights);
  }finally{await browser.close();await host.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
