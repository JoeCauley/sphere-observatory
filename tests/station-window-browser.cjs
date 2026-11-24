'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const {session, executable} = require('./support/biome-browser.cjs');

(async () => {
  const host = await session();
  const browser = await chromium.launch({headless:true, executablePath:executable()});
  try {
    const page = await browser.newPage({viewport:{width:1120,height:740}});
    await page.goto(host.origin+'/?border=wall');
    await page.waitForFunction(() => window.SphereLoading?.ready && SphereStageFrame.approachLabel(SphereApp.getState()).includes('maintenance wall'), null, {timeout:120000});
    const sample = await page.evaluate(async () => {
      const geo = await import('./geographic-flight.js');
      const item = SphereBiomeLibrary.entry('border-transport'), d = item.transport;
      const site = d.sites.find(s => s.bay===0);
      const {station,makeView} = await SphereStageFrame.stationExterior(site.address,SphereBiomeLibrary.persistence==='file');
      const habitats = SphereStageFrame.stationHabitats(d);
      const canvas = document.createElement('canvas');
      canvas.style.cssText='width:640px;height:400px;position:fixed;top:0;left:0';
      document.body.append(canvas);
      const view = makeView(canvas,{district:d,habitats,land:SphereStageFrame.stationLand(d)});
      view.load(station);
      const shots=[];
      for(const side of [-1,1]){
        const z=side<0?0:station.widthM;
        view.draw(station,[station.routes[0].nearDoor[0],1.7,z-side*2.5],side<0?Math.PI:0,0,0,false,1);
        shots.push(canvas.toDataURL('image/jpeg',.9).split(',')[1]);
      }
      // Keep the eye, orange frame and sky pixels fixed. Only the addressed
      // frontage changes. This also verifies that the aerial swap below is live.
      const door=station.routes[0].farDoor;
      habitats.reverse();
      view.draw(station,[door[0],1.7,door[2]-2.5],0,0,0,false,1);
      const swappedDoor=canvas.toDataURL('image/jpeg',.9).split(',')[1];
      habitats.reverse();
      // At approach altitude the geometry and regional land are still visible.
      // Swapping only the two doorway views must not tint any part of the sky
      // or terrain 64 km down the wall. The two close-up shots above must differ.
      const gl=canvas.getContext('webgl2'), aerialChanges=[];
      const sampleTerrain=height=>{
        view.draw(station,[64000,height,5600+station.widthM/2],1.5,.04,0,false,1);
        const pixels=new Uint8Array(canvas.width*4);
        gl.readPixels(0,Math.floor(canvas.height*.18),canvas.width,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        return pixels;
      };
      for(const altitude of [17800,14300,10500,14300,17800]){
        const original=sampleTerrain(altitude);
        habitats.reverse();
        const swapped=sampleTerrain(altitude);
        habitats.reverse();
        aerialChanges.push(original.reduce((n,v,i)=>n+Number(v!==swapped[i]),0));
      }
      // Looking into the 48 km hall exposes a different failure from facing
      // the nearby jamb. Compare finished pixels from both actual renderers.
      SphereApp.setPlaying(false);
      const pose={eastM:site.x+door[0]+.5,northM:station.widthM/2-35,altitudeM:1.7,yaw:Math.PI,pitch:0,mode:'walk'};
      const w=canvas.width,h=canvas.height,focal=1.428148;
      const state={...geo.mainPose(SphereApp.getState(),item,pose,SphereAtlas,SphereWorld),
        fov:2*Math.atan(w/h/focal)*180/Math.PI,projection:'perspective',playing:false};
      const direct=state.routeShades?SphereCollection.visibility(state.position,state,64):1;
      const ceilingBands=g=>[.58,.72,.86].map(height=>{
        const row=new Uint8Array(4*Math.floor(w*.30));
        g.readPixels(Math.floor(w*.35),Math.floor(h*height),row.length/4,1,g.RGBA,g.UNSIGNED_BYTE,row);
        return [0,1,2].map(channel=>{
          let sum=0;
          for(let i=channel;i<row.length;i+=4)sum+=row[i];
          return sum*4/row.length;
        });
      });
      view.draw(station,[pose.eastM-site.x,pose.altitudeM,pose.northM+station.widthM/2],pose.yaw,0,SphereApp.sceneSeconds,false,direct,{focal});
      const stationBands=ceilingBands(gl),renderer=SphereApp.renderer;
      const heading=state.forward;
      SphereLanding.enter(state,state.position,{activate:false,grounded:true});state.forward=heading;
      await renderer.prepare(state);
      const until=performance.now()+10000;
      do{
        SphereStageFrame.regionalFrame(performance.now(),false,state);
        renderer.draw(state,w,h,{exportFrame:true});
        if(renderer.renderInfo.walkingStation)break;
        await new Promise(resolve=>setTimeout(resolve,40));
      }while(performance.now()<until);
      if(!renderer.renderInfo.walkingStation)throw Error('Native station did not become resident');
      const nativeBands=ceilingBands(renderer.gl);
      const ceilingDelta=Math.max(...nativeBands.flatMap((row,i)=>row.map((v,j)=>Math.abs(v-stationBands[i][j]))));
      const nativeError=renderer.error();
      const error=gl.getError();
      view.dispose();canvas.remove();
      const camera={eastM:site.x+64000,northM:5600,altitudeM:14300,yaw:1.5,pitch:.04,mode:'flight'};
      SphereApp.setState({...geo.mainPose(SphereApp.getState(),item,camera,SphereAtlas,SphereWorld),fov:80});
      SphereApp.draw();
      return {shots,error,nativeError,habitats,aerialChanges,swappedDoor,ceilingDelta};
    });
    assert.equal(sample.error,0);
    assert.deepEqual(sample.habitats,[1,2],'Seed 713 must open onto Meadow and native Super Jungle in canonical order');
    assert.notEqual(sample.shots[0],sample.shots[1]);
    assert.notEqual(sample.shots[1],sample.swappedDoor,'Changing the outside biome must change the view through the same jamb');
    assert(sample.aerialChanges.every(changed=>changed===0),'Doorway sky leaked into the aerial approach: '+sample.aerialChanges);
    assert.equal(sample.nativeError,0);
    assert(sample.ceilingDelta<15,'Native hall ceiling diverged from the enclosed station: '+sample.ceilingDelta+'/255');
    const out=process.env.SPHERE_BORDER_OUTPUT;
    if(out){
      fs.mkdirSync(out,{recursive:true});
      sample.shots.forEach((data,i)=>fs.writeFileSync(path.join(out,'door-'+i+'.jpg'),Buffer.from(data,'base64')));
      await page.locator('#viewport').screenshot({path:path.join(out,'habitat-flight.jpg'),type:'jpeg',quality:87});
    }
    console.log('Door habitats',sample.habitats,'WebGL error',sample.error,'interior ceiling delta',sample.ceilingDelta);
  }finally{await browser.close();await host.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
