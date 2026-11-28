'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const {session, executable} = require('./support/biome-browser.cjs');

async function main() {
  const server = await session();
  const browser = await chromium.launch({headless:true, executablePath:executable()});
  try {
    const page = await browser.newPage({viewport:{width:1360,height:820}});
    await server.attach(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.origin+'/?border=wall', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.SphereLoading?.ready && window.SphereStageFrame &&
      SphereBiomeLibrary.entry('border-transport'), null, {timeout:300000});
    const result = await page.evaluate(async capture => {
      const geo = await import('./geographic-flight.js');
      const stage = SphereStageFrame, renderer = SphereApp.renderer;
      const item = SphereBiomeLibrary.entry('border-transport'), district = item.transport;
      const site = district.sites.find(s => s.bay === 0);
      const {station} = await stage.stationExterior(site.address, SphereBiomeLibrary.persistence === 'file');
      const route = station.routes.find(r => r.id === 'trunk');
      const width = 1152, height = 580, mid = station.widthM/2;
      const start = {eastM:site.x+route.farDoor[0],northM:mid+4,altitudeM:1.7,yaw:Math.PI,pitch:0,mode:'walk'};
      SphereApp.setPlaying(false);
      SphereApp.setBusy(true);
      const state = {...geo.mainPose(SphereApp.getState(),item,start,SphereAtlas,SphereWorld),
        fov:90,projection:'perspective',playing:false};
      SphereLanding.enter(state,state.position,{activate:false,grounded:true});
      await renderer.prepare(state);
      const shots = [];
      for (let step = 0; step < 2; step++) {
        if (step) {
          const keys = new Set(['KeyD']);
          for (let frame = 0; frame < 60; frame++) SphereLanding.step(state,keys,1/60);
        }
        const until = performance.now()+20000;
        do {
          stage.regionalFrame(performance.now(),false,state);
          renderer.draw(state,width,height,{exportFrame:true});
          const info = renderer.renderInfo.walkingStationPictures;
          if (info?.failed) throw Error('The distant Meadow failed to load');
          if (info?.pictures.some(card => card.activeKey.endsWith('/trunk') && card.reuseCount > 0)) break;
          await new Promise(resolve => setTimeout(resolve,30));
        } while (performance.now() < until);
        const pose = geo.packPose(state,item,SphereAtlas,SphereWorld);
        const axes = geo.stationBasis(state,district,pose,SphereWorld);
        const eye = [pose.eastM-site.x, pose.altitudeM, pose.northM+mid];
        const pixels = new Uint8Array(width*height*4), gl = renderer.gl;
        gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        // Sample surveyed world positions. The patches move with the view when the player sidesteps.
        const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
        function sample(x,y,z) {
          const delta = [x-eye[0],y-eye[1],z-eye[2]], depth = dot(delta,axes.forward);
          const u = Math.round(width/2*(1+dot(delta,axes.right)/depth));
          const v = Math.round(height/2+width/2*dot(delta,axes.up)/depth);
          const rgb = [[],[],[]];
          for(let j=v-1;j<=v+1;j++) for(let i=u-1;i<=u+1;i++) {
            const base = 4*(j*width+i);
            rgb.forEach((values,c) => values.push(pixels[base+c]));
          }
          return rgb.map(values => values.sort((a,b)=>a-b)[4]);
        }
        const links = [-geo.hallHalfM,geo.hallHalfM].map(x => ({
          passage:sample(x,940,mid), wall:sample(x,940,mid+3200)
        }));
        shots.push({pose, time:state.time, links, craneWell:sample(7100,1700,mid),
          meadow:sample(route.nearDoor[0],route.door[1]*.62,0),
          picture:renderer.renderInfo.walkingStationPictures?.pictures.find(card=>card.activeKey.endsWith('/trunk')),
          station:renderer.renderInfo.walkingStation, environment:renderer.renderInfo.borderEnvironment, gl:gl.getError(),
          image:capture?renderer.canvas.toDataURL().split(',')[1]:null});
        if(step===1){
          // Leave the player fixed and find a time when an actual Shade covers the star.
          const clock={...state,routeShades:true};
          let shadowTime;
          for(let t=0;t<=2000000;t+=120){
            clock.time=t;
            if(SphereCollection.visibility(clock.position,clock,64)===0){shadowTime=t;break;}
          }
          if(shadowTime===undefined)throw Error('The test could not find night at the Jungle entrance');
          state.time=shadowTime;state.routeShades=true;
          stage.regionalFrame(performance.now(),false,state);
          renderer.draw(state,width,height,{exportFrame:true});
          gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
          shots.at(-1).night={time:shadowTime,meadow:sample(route.nearDoor[0],route.door[1]*.62,0),
            captures:renderer.renderInfo.walkingStationPictures.pictures.find(card=>card.activeKey.endsWith('/trunk')).captureCount};
          if(capture) shots.at(-1).nightImage=renderer.canvas.toDataURL().split(',')[1];
        }
      }
      return {key:station.address.key,habitats:stage.stationHabitats(district,station),shots};
    },!!process.env.SPHERE_BORDER_OUTPUT);
    if(process.env.SPHERE_BORDER_OUTPUT) fs.mkdirSync(process.env.SPHERE_BORDER_OUTPUT,{recursive:true});
    result.shots.forEach(({image,nightImage,...shot},i) => {
      if(image) fs.writeFileSync(path.join(process.env.SPHERE_BORDER_OUTPUT,'jungle-apron-'+i+'.png'),Buffer.from(image,'base64'));
      if(nightImage) fs.writeFileSync(path.join(process.env.SPHERE_BORDER_OUTPUT,'jungle-apron-night.png'),Buffer.from(nightImage,'base64'));
      console.log('Super Jungle apron',JSON.stringify(shot));
      assert.equal(shot.station,result.key);
      assert.equal(shot.environment.zone,'biome');
      assert.equal(shot.gl,0);
      assert(shot.picture?.reuseCount > 0,'The opposite Meadow door must display a cached view');
      // Independently measured from the native Meadow sky shader along the same ray.
      const matchesSky=(pixel,reference)=>pixel.every((v,c)=>Math.abs(v-reference[c])<=4);
      assert(matchesSky(shot.meadow,[174,201,215]),'Exterior haze obscures the distant Meadow sky');
      if(shot.night){
        assert(shot.night.captures>shot.picture.captureCount,'Nightfall must invalidate the bright still');
        assert(matchesSky(shot.night.meadow,[25,30,40]),'The distant door must show the dark Meadow');
      }
      for(const link of shot.links) {
        assert(link.passage[1] < link.wall[1]+40,'The link opens onto bright Jungle sky');
        assert(shot.craneWell[1] > link.passage[1]+30,'The real open crane well must remain distinct from the enclosed link');
      }
    });
    assert.deepEqual(result.habitats,[1,2]);
    assert.deepEqual(errors,[]);
    const [before,after] = result.shots.map(s=>s.pose.eastM);
    assert(Math.abs(after-before)>1,'The second view must come from an actual sidestep on the apron');
  } finally {
    await browser.close();
    await server.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
