'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { session, executable } = require('./support/biome-browser.cjs');

async function main() {
  const host = await session(), browser = await chromium.launch({ executablePath: executable(), headless: true });
  const errors = [];
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 1040, height: 680 } });
    await host.attach(context);
    await context.addInitScript(() => {
      // Held movement resumes on this event. A later driver poll can see a pilot
      // who has already flown several metres beyond the transferred camera.
      window.addEventListener('keydown', event => {
        const entry = window.frameElement?.surfaceEntry;
        if (!entry?.geographic || !entry.active || !window.SphereBiome || window.firstGeographicInput) return;
        if (event.code !== 'KeyW' && event.code !== 'KeyQ') return;
        window.firstGeographicInput = { key: event.code, pose: window.SphereBiome.pose(), entered: { ...entry.pose } };
      }, true);
    });
    page = await context.newPage();
    page.setDefaultTimeout(240000);
    page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
    await page.goto(host.origin, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.SphereLoading?.ready && window.SphereBiomeLibrary?.world);
    await page.evaluate(async () => {
      const s = SphereApp.getState();
      s.seed = 713; s.playing = false;
      SphereApp.setState(s);
      await SphereBiomeLibrary.selectWorld();
      for (const id of ['border-outfall','sideways-city','infinite-industry']) await SphereBiomeLibrary.install(id);
    });
    await page.waitForFunction(() => SphereStageFrame.surfaceAddress() && SphereLoading.ready);
    async function place(id, altitudeKm, external = false, westEdge = false) {
      return page.evaluate(async ({ id, altitudeKm, external, westEdge }) => {
        const lib = SphereBiomeLibrary, atlas = SphereAtlas, world = SphereWorld;
        const geo = await import('./geographic-flight.js'), kit = await import('./packs/kit/surface-route.js');
        const item = lib.entry(id), home = atlas.byId(item.edge?.near ?? item.plotId), s = SphereApp.getState();
        let g = {latitude:home.latitude+home.halfHeight*.23,longitude:home.longitude+Math.PI/home.columns*(external?1.32:.31)};
        if(westEdge)g.longitude=home.longitude-Math.PI/home.columns-.16/(s.radius*Math.cos(g.latitude));
        if(item.edge){
          const gate=kit.chartFor(home,item.edge,s.radius);
          const p=kit.toMeadow({eastM:410,northM:-1500,altitudeM:0,yaw:0},gate,0);
          g=kit.unproject(home,p.eastM,p.northM,s.radius*1000);
        }
        const direction = world.direction(g.latitude,g.longitude,s);
        s.position = SphereMath.mul(direction,s.radius-altitudeKm);
        s.forward = SphereSites.shellFrame(direction)[0]; s.up = SphereMath.mul(direction,-1);
        if(westEdge){
          const ahead=world.direction(g.latitude,g.longitude+1e-7,s);
          s.forward=SphereMath.norm(SphereMath.sub(ahead,SphereMath.mul(direction,SphereMath.dot(ahead,direction))));
        }
        s.walkMode=false; s.walkSurface=false; s.walkPosition=null; s.walkVelocity=0;
        s.siteId=''; s.siteAnchor=null; s.terrainAnchor=null; s.shadeAttachment=null;
        s.playing=false; s.autoSpeed=false; s.speed=2;
        SphereApp.setState(s);
        await SphereLoading.ensureCurrent();
        const start = SphereApp.getState();
        return {expected:geo.packPose(start,item,atlas,world), footprint:geo.footprint(start,lib,atlas,world)?.id, label:SphereStageFrame.approachLabel(start)};
      }, {id,altitudeKm,external,westEdge});
    }
    async function move(key='KeyW') {
      await page.locator('#viewport').focus();
      await page.keyboard.down(key);
    }
    async function noEntry() {
      await move();
      try { await page.waitForTimeout(650); }
      finally { await page.keyboard.up('KeyW'); }
      assert.equal(await page.evaluate(() => SphereStageFrame.current?.id ?? null),null);
    }
    const above = await place('infinite-meadow',32);
    assert.match(above.label,/Infinite Meadow.*20 km/);
    await noEntry();
    const blank = await place('infinite-meadow',12,true);
    assert.equal(blank.footprint,undefined);
    await noEntry();
    console.log('PASS orbit and the adjacent uninstalled plot remain in Main');
    for (const id of ['infinite-meadow','infinite-industry','sideways-city','border-outfall']) {
      const descends=id==='infinite-meadow', crossesEdge=id==='infinite-industry', key=descends?'KeyQ':'KeyW';
      const initial = await place(id,descends?20.15:19.9,false,crossesEdge);
      assert.equal(initial.footprint,crossesEdge?undefined:id);
      await move(key);
      try {
        await page.waitForFunction(id => {
          const stage=SphereStageFrame;
          if(stage.lastArrival?.status==='failed'||document.querySelector('#stageRecovery')) throw Error(document.getElementById('biomeLibraryStatus').textContent);
          return stage.lastArrival?.route==='geographic' && stage.current?.id===id && document.querySelector('#stageFrame iframe')?.contentWindow?.firstGeographicInput;
        },id,{polling:100,timeout:90000});
      } finally { await page.keyboard.up(key); }
      const first = await page.evaluate(() => document.querySelector('#stageFrame iframe').contentWindow.firstGeographicInput);
      const {pose,entered} = first;
      assert.equal(first.key,key,id+' resumed the held flight control');
      const slip = Math.hypot(initial.expected.eastM-pose.eastM,initial.expected.northM-pose.northM);
      assert(slip < 950, id+' lateral position differed by '+slip+' m');
      assert(Math.abs(entered.altitudeM-initial.expected.altitudeM)<950,id+' Main approach altitude '+entered.altitudeM);
      assert(Math.hypot(entered.eastM-pose.eastM,entered.northM-pose.northM)<.01,id+' pack displacement on entry');
      assert(Math.abs(entered.altitudeM-pose.altitudeM)<.01,id+' pack altitude on entry');
      assert(Math.cos(pose.yaw-initial.expected.yaw)>.9999,id+' bearing');
      if(id==='sideways-city'){
        await page.frameLocator('#stageFrame iframe').locator('#world').focus();
        await page.keyboard.down('KeyE');
        try { await page.waitForFunction(() => !SphereStageFrame.current,null,{polling:50,timeout:30000}); }
        finally { await page.keyboard.up('KeyE'); }
        const height=await page.evaluate(()=>{const s=SphereApp.getState();return s.radius-Math.hypot(...s.position);});
        assert(height>=24 && height<50,'Unexpected departure altitude '+height);
      } else {
        await page.evaluate(()=>SphereStageFrame.showMain());
      }
      console.log('PASS free flight into '+id+(descends?' by descending through 20 km':crossesEdge?' by flying across its western border at 19.9 km':' at 19.9 km')+' with the original position and bearing'+(id==='sideways-city'?', then climbed back to the Sphere':''));
    }
    assert.deepEqual(errors,[]);
  } catch(e) {
    console.error(await page?.evaluate(()=>({status:document.getElementById('biomeLibraryStatus')?.textContent,ready:window.SphereLoading?.ready,stage:window.SphereStageFrame?.current?.id,arrival:window.SphereStageFrame?.lastArrival?.route})).catch(()=>null));
    throw e;
  } finally { await browser.close(); await host.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
