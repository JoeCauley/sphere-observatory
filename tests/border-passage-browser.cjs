'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright'),{session,executable}=require('./support/biome-browser.cjs');
(async()=>{
 const host=await session(),browser=await chromium.launch({headless:true,executablePath:executable()});
 try{
  const ctx=await browser.newContext({viewport:{width:1100,height:700}});await host.attach(ctx);
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(240000);
  await p.goto(host.origin,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>window.SphereLoading?.ready && window.SphereBiomeLibrary?.world);
  const floorSamples=await p.evaluate(async()=>{
    const {createRenderer}=await import('./packs/border-outfall/1.0.0/render.js');
    const {initial}=await import('./packs/border-outfall/1.0.0/model.js');
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
    const renderer=createRenderer(canvas),gl=canvas.getContext('webgl2'),s=initial(),samples=[];
    try{
      for(const northM of [500,500000,725000,900000,999500])for(const yaw of [0,Math.PI]){
        Object.assign(s.pose,{eastM:-1,northM,altitudeM:1.7,pitch:-.19,yaw,mode:'walk'});
        renderer.draw(s,0,0,{resize:false});
        const rgb=new Uint8Array(4);
        gl.readPixels(160,35,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgb);
        samples.push({northM,yaw,rgba:[...rgb]});
      }
    }finally{renderer.dispose();}
    return samples;
  });
  for(const sample of floorSamples){
    const [r,g,b,a]=sample.rgba;
    assert(a===255 && g>r && g<120 && b<120,'Expected a lit tunnel floor under the eye '+JSON.stringify(sample));
  }
  console.log('PASS rendered floor ahead and behind the walker at five tunnel stations',JSON.stringify(floorSamples));
  const uninstalled=await p.evaluate(async()=>{
    const state=SphereApp.getState(),items=SphereBiomeLibrary.installed();
    if(items.length)throw Error('Expected a fresh installation register');
    const env={math:SphereMath,world:SphereWorld,collection:SphereCollection,atlas:SphereAtlas};
    const {circuits}=await import('./tests/support/surface-circuits.mjs'),{along}=await import('./surface-passages.js');
    const plan=circuits(state,items,env)[0],edge=plan.legs.find(leg=>leg.kind==='tunnel');
    const at=a=>along(plan.circle.origin,plan.circle.forward,a);
    const before=at(edge.start-.002/state.radius),after=at(edge.start+.002/state.radius);
    if(!await SphereStageFrame.walkGround(before)||!await SphereStageFrame.crossWalkingEdge(before.q,after.q,before.forward))throw Error('Could not enter the uninstalled passage');
    const api=document.querySelector('#stageFrame iframe').contentWindow.SphereBiome;
    if(!await api.walkTunnel(1000001/3.3))throw Error('Could not leave the uninstalled passage');
    const s=SphereApp.getState(),q=SphereMath.norm(s.position);
    return {floor:s.walkMode&&s.walkSurface,owner:'main-'+SphereWorld.sample(q,s).id,expected:edge.gate.far.id,installed:SphereBiomeLibrary.installed().length};
  });
  assert(uninstalled.floor);assert.equal(uninstalled.owner,uninstalled.expected);assert.equal(uninstalled.installed,0);
  console.log('PASS crossed a Main habitat boundary with an empty installation register.');
  await p.evaluate(()=>SphereBiomeLibrary.install('border-outfall'));
  const open=await p.evaluate(async()=>{
   const api=await import('./surface-passages.js'),geo=await import('./geographic-flight.js'),s=SphereApp.getState(),lib=SphereBiomeLibrary,item=lib.entry('border-outfall');
   const origin=geo.mainPose(s,item,{eastM:-1,northM:api.tunnelStart,altitudeM:1.7,yaw:0,pitch:0,mode:'walk'},SphereAtlas,SphereWorld);
   const q=SphereMath.norm(origin.position),gate=api.passageAt(q,origin.forward,s.radius);
   const name=q=>api.ownerAt(q,s,lib.installed(),SphereAtlas,SphereWorld);
   Object.assign(gate.near,{id:'border-outfall',name:item.name,pack:true,tint:[.16,.42,.15]});
   Object.assign(gate.far,name(gate.far.q),{tint:SphereWorld.sample(gate.far.q,s).color});
   const pose={eastM:-1,northM:api.tunnelStart+.5,altitudeM:1.7,yaw:0,pitch:0,mode:'walk'};
   window.walkGate=gate;
   return SphereStageFrame.walkGround(gate.near,gate,pose);
  });
  assert(open,await p.locator('#biomeLibraryStatus').textContent());
  const overPack=await p.evaluate(()=>{
    const card=SphereTransitStatus.begin('Outfall passage','Preparing the adjoining ground.');
    const title=document.querySelector('#transitTitle').getBoundingClientRect();
    const top=document.elementFromPoint(title.x+8,title.y+8);
    const visible=document.querySelector('#travelCurtain').contains(top);card.end();return visible;
  });
  assert(overPack,'The status card must paint above the live biome frame');
  const frame=p.locator('#stageFrame iframe').contentFrame();
  await frame.locator('#world').focus();await p.keyboard.down('KeyW');await p.waitForTimeout(400);await p.keyboard.up('KeyW');
  const inspect=()=>p.evaluate(()=>{const b=document.querySelector('#stageFrame iframe').contentWindow.SphereBiome;return {pose:b.pose(),inspect:b.inspect()};});
  assert((await inspect()).pose.northM>43.6);
  assert(await p.evaluate(()=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.walkTunnel(500000/3.3)));
  const middle=await inspect();assert(middle.pose.northM>500043&&middle.pose.northM<500050);assert.equal(middle.pose.mode,'walk');
  if(process.env.SPHERE_TUNNEL_PHOTO){await p.waitForTimeout(200);await frame.locator('#world').screenshot({path:process.env.SPHERE_TUNNEL_PHOTO,type:'jpeg',quality:88});}
  const expected=await p.evaluate(()=>walkGate.far.q);
  if(process.env.SPHERE_TEST_RELOAD!=='0'){
    await p.waitForFunction(north=>{
      const saved=JSON.parse(SphereBiomeLibrary.saveStorage().getItem('sphere-stage-frame-v2'));
      return saved?.passage && Math.abs(saved.pose.northM-north)<.01;
    },middle.pose.northM);
    await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.querySelector('#stageFrame iframe')?.surfaceEntry?.active);
    assert(Math.abs((await inspect()).pose.northM-middle.pose.northM)<.01);
  }
  assert(await p.evaluate(()=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.walkTunnel(500001/3.3)),await p.locator('#biomeLibraryStatus').textContent());
  const end=await p.evaluate(()=>{const s=SphereApp.getState();return {q:SphereMath.norm(s.position),mode:s.walkMode,id:s.siteId,gl:SphereApp.renderer.gl.getError(),stage:SphereStageFrame.current};});
  assert(end.mode);assert.equal(end.stage,null);assert(Math.hypot(...expected.map((x,i)=>x-end.q[i]))<1e-10);
  assert.equal(end.gl,0);
  await p.locator('#viewport').focus();
  await p.keyboard.down('KeyS');
  try{await p.waitForFunction(()=>document.querySelector('#stageFrame iframe')?.surfaceEntry?.active,null,{timeout:15000});}
  finally{await p.keyboard.up('KeyS');}
  const back=await inspect();assert(back.pose.northM>1000038);assert.equal(back.pose.mode,'walk');
  assert(await p.evaluate(()=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.walkTunnel(1000001/3.3,-1)));
  const near=await inspect();assert.equal(near.pose.mode,'walk');assert(Math.abs(near.pose.northM-43)<.02);
  assert(await p.evaluate(()=>document.querySelector('#stageFrame iframe').contentWindow.SphereBiome.walkTunnel(2/3.3)));
  await p.waitForFunction(()=>{
    const child=document.querySelector('#stageFrame iframe').contentWindow;
    return child.document.querySelector('#status').textContent.includes(SphereStageFrame.servicePassage(child).far.name);
  });
  const service=await p.evaluate(async()=>{
    const child=document.querySelector('#stageFrame iframe').contentWindow;
    const gate=SphereStageFrame.servicePassage(child,child.SphereBiome.pose().eastM);
    if(!gate || !child.document.querySelector('#status').textContent.includes(gate.far.name))throw Error('Missing registered tunnel destination');
    const ok=await child.SphereBiome.walkTunnel(1000001/3.3),s=SphereApp.getState(),q=SphereMath.norm(s.position);
    return ok&&s.walkMode&&Math.hypot(...q.map((x,i)=>x-gate.far.q[i]))*s.radius*1000<.5;
  });
  assert(service,'The installed Outfall must also reach its named, geographically correct far portal');
  assert.deepEqual(errors,[]);console.log('PASS keyboard entry, midpoint save and reload, grounded arrival in',end.id,'and keyboard turn-back to the original Outfall floor.');
 }finally{await browser.close();await host.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
