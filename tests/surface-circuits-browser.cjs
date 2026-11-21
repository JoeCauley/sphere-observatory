'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{session,executable}=require('./support/biome-browser.cjs');

(async()=>{
  const host=await session(),browser=await chromium.launch({headless:process.env.SPHERE_WALK_HEADLESS!=='0',executablePath:executable()});
  try{
    const ctx=await browser.newContext({viewport:{width:960,height:620}});await host.attach(ctx);
    const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(300000);
    await page.goto(host.origin,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready && window.SphereBiomeLibrary?.world);
    if(process.env.SPHERE_WALK_SEED!==undefined){
      const override=Number(process.env.SPHERE_WALK_SEED);
      if(!Number.isSafeInteger(override))throw Error('SPHERE_WALK_SEED must be an integer');
      await page.evaluate(seed=>window.walkSeed=seed,override);
    }
    await page.evaluate(async()=>{
      const lib=SphereBiomeLibrary;
      for(const info of lib.packs())await lib.install(info.id);
      const state=SphereApp.getState();if(!state.collection||state.era!=='after')throw Error('Expected the live damaged Sphere');
      const env={math:SphereMath,world:SphereWorld,collection:SphereCollection,atlas:SphereAtlas},items=lib.installed();
      const {circuits,runCircuit,seed:defaultSeed,blockedCityDoor}=await import('./tests/support/surface-circuits.mjs');
      const seed=window.walkSeed??defaultSeed;
      const paths=circuits(state,items,env,seed),along=(await import('./surface-passages.js')).along;
      const geo=await import('./geographic-flight.js');
      const seen=new Set();
      const witness=()=>{
        const core=SphereApp.getState(),child=document.querySelector('#stageFrame iframe')?.contentWindow;
        if(child){
          const api=child.SphereBiome,p=api.pose(),item=lib.entry(api.id);
          if(p.mode!=='walk'||api.inspect().frames<1)throw Error('Missing walking support in '+api.id);
          const q=SphereMath.norm(geo.mainPose(core,item,p,SphereAtlas,SphereWorld).position);
          if(child.document.querySelector('canvas')?.getContext('webgl2')?.getError())throw Error('Pack WebGL error: '+api.id);
          return {id:api.id,q};
        }
        if(!core.walkMode||!core.walkSurface)throw Error('Main left walking mode');
        if(SphereApp.renderer.gl.getError()||SphereApp.renderer.gl.isContextLost())throw Error('Main WebGL error');
        const q=SphereMath.norm(core.position);
        return {id:'main-'+SphereWorld.sample(q,core).id,q};
      };
      const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))*state.radius*1000;
      function verify(point,id){
        const got=witness(),m=dist(point.q,got.q);
        if(got.id!==id||!(m<.5))throw Error('Expected '+id+' at route coordinate, reached '+got.id+' with '+m+' m error');
        seen.add(id);return got;
      }
      async function ground(point,id){
        if(!await SphereStageFrame.walkGround(point))throw Error('Could not walk into '+id+': '+document.querySelector('#biomeLibraryStatus').textContent);
        return verify(point,id);
      }
      async function checkBlockedDoor(){
        if(lib.entry('sideways-city')?.plotId!==blockedCityDoor.plotId)return null;
        const {q,forward}=blockedCityDoor,before=along(q,forward,-.002/state.radius),after=along(q,forward,.002/state.radius);
        const {ownerAt,passageAt}=await import('./surface-passages.js');
        const far=passageAt(q,forward,state.radius).far.q;
        if(ownerAt(far,state,items,env.atlas,env.world).id!=='sideways-city')return null;
        if(!await SphereStageFrame.walkGround(before)||!await SphereStageFrame.crossWalkingEdge(before.q,after.q,forward))throw Error('Blocked City portal did not open');
        const frame=document.querySelector('#stageFrame iframe'),gate=frame.surfaceEntry.passage;
        if(!gate.surveyOffsetM||gate.far.id!=='sideways-city')throw Error('The obstructed outlet was not surveyed');
        if(Math.abs(dist(gate.near.q,gate.far.q)-1000000)>.001)throw Error('Survey changed the straight tunnel length');
        if(!await frame.contentWindow.SphereBiome.walkTunnel(1000001/3.3))throw Error('Surveyed City outlet failed');
        if(witness().id!==gate.far.id||dist(witness().q,gate.far.q)>.5)throw Error('City outlet missed open ground');
        return gate.surveyOffsetM;
      }
      window.circuitChecks={paths,seed,state,items,seen,witness,env,checkBlockedDoor,run:async function(i){
        const plan=paths[i],model=runCircuit(plan,state,items,env),at=angle=>along(plan.circle.origin,plan.circle.forward,angle);
        const atStart=await ground(at(0),plan.legs[0].owner?.id??plan.legs[0].gate.near.id);
        let passages=0,supported=0,swept=0,here=atStart;
        const tangent=q=>SphereMath.norm(SphereMath.cross(plan.circle.normal,q));
        const accept=next=>{
          const delta=Math.atan2(SphereMath.dot(plan.circle.normal,SphereMath.cross(here.q,next.q)),SphereMath.dot(here.q,next.q));
          if(delta< -1e-10 || delta>Math.PI*.95)throw Error('Broken or reversed geographic stride');
          swept+=delta;here=next;
        };
        // The next footfall is integrated from the live camera, never from a saved waypoint.
        const step=(km)=>along(here.q,tangent(here.q),km/state.radius);
        for(const [index,leg] of plan.legs.entries()){
          if(leg.kind==='ground'){
            const nextIsMouth=plan.legs[index+1]?.kind==='tunnel';
            for(const km of [leg.km/2,leg.km/2-(nextIsMouth ? .001 : 0)]){
              const landing=step(km);accept(await ground(landing,leg.owner.id));
            }
            if(dist(here.q,at(leg.end-(nextIsMouth ? .001 : 0)/state.radius).q)>.25)throw Error('Stride drifted off the route');
            supported++;continue;
          }
          const before=here.q,after=step(.002);
          if(!await SphereStageFrame.crossWalkingEdge(before,after.q,tangent(before))){
            const owner=q=>env.world.sample(q,state).name;
            throw Error(plan.label+' edge '+index+' from '+here.id+' ('+owner(before)+' to '+owner(after.q)+'): '+document.querySelector('#biomeLibraryStatus').textContent);
          }
          const f=document.querySelector('#stageFrame iframe'),api=f.contentWindow.SphereBiome,gate=f.surfaceEntry?.passage;
          if(!gate||dist(gate.near.q,leg.gate.near.q)>.25||gate.near.id!==leg.gate.near.id||gate.far.id!==leg.gate.far.id)throw Error('Unexpected portal or neighbouring biome');
          if(api.pose().mode!=='walk'||api.inspect().frames<1)throw Error('Missing Outfall floor');
          const toMid=500043-api.pose().northM;
          if(!await api.walkTunnel(toMid/3.3)||Math.abs(api.pose().northM-500043)>.001)throw Error('Tunnel midpoint was skipped');
          if(!await api.walkTunnel(500000/3.3))throw Error(plan.label+' edge '+index+' far portal to '+leg.gate.far.name+' failed: '+document.querySelector('#biomeLibraryStatus').textContent);
          accept(verify(leg.gate.far,leg.gate.far.id));
          if(leg.installation){
            const edge=lib.entry(leg.installation).edge;
            if(dist(gate.near.q,SphereWorld.direction(edge.latitude,edge.longitude,state))>5)throw Error('Missed installed service opening');
            seen.add(leg.installation);
          }
          passages++;
        }
        const liveClosureM=dist(atStart.q,here.q),liveDegrees=swept*180/Math.PI;
        if(here.id!==atStart.id||liveClosureM>=.5||Math.abs(liveDegrees-360)>1e-8)throw Error('Native walk did not close: '+here.id+' '+liveClosureM+' m '+liveDegrees+' degrees');
        return {...model,nativeGroundLegs:supported,renderedTunnels:passages,liveClosureM,liveDegrees};
      }};
    });
    const info=await page.evaluate(()=>({seed:circuitChecks.seed,labels:circuitChecks.paths.map(p=>p.label),radiusKm:circuitChecks.state.radius,installed:circuitChecks.items.map(i=>({id:i.id,plot:i.plotId??i.edge?.id,requiresDistrictWalk:!!i.transport}))}));
    const part=process.env.SPHERE_WALK_SHARD||'1/1',match=/^(\d+)\/(\d+)$/.exec(part);
    if(!match||+match[1]<1||+match[1]>+match[2]||+match[2]>info.labels.length)throw Error('Expected a walking shard such as 1/3');
    const slot=+match[1]-1,slots=+match[2];
    const results=[],report={...info,shard:part,results};console.log('ROUTES',info.labels.length,'shard',part);
    if(slot===0){
      report.blockedDoorOffsetM=await page.evaluate(()=>circuitChecks.checkBlockedDoor());
      if(report.blockedDoorOffsetM!==null)console.log('PASS obstructed City outlet was surveyed',report.blockedDoorOffsetM,'m');
    }
    for(let i=slot;i<info.labels.length;i+=slots){
      const record=await page.evaluate(i=>circuitChecks.run(i),i);results.push(record);
      console.log('PASS',i+1,record.label,record.inclinationDeg.toFixed(2)+' degrees',record.renderedTunnels+' tunnels',record.liveClosureM.toFixed(6)+' m');
      if(process.env.SPHERE_CIRCUIT_REPORT)fs.writeFileSync(process.env.SPHERE_CIRCUIT_REPORT,JSON.stringify(report,null,2)+'\n');
    }
    const visited=await page.evaluate(()=>[...circuitChecks.seen]);
    if(slots===1){
      assert(info.installed.filter(item=>!item.requiresDistrictWalk).every(item=>visited.includes(item.id)));
      for(const id of [0,1,2,3,4,5,6,7,8,9,10,11,12,15])assert(visited.includes('main-'+id));
    }
    for(const route of results)for(const id of route.visits)assert(visited.includes(id),id);
    assert.deepEqual(errors,[]);
    report.visited=visited;report.status='passed';report.pageErrors=errors;
    if(process.env.SPHERE_CIRCUIT_REPORT)fs.writeFileSync(process.env.SPHERE_CIRCUIT_REPORT,JSON.stringify(report,null,2)+'\n');
    console.log('PASS',results.length,'native signed revolutions with grounded returns;',visited.length,'surface owners or installations in shard',part);
  }finally{await browser.close();await host.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
