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
    const context = await browser.newContext({viewport:{width:1120,height:740}});
    await host.attach(context);
    const page = await context.newPage();
    await page.goto(host.origin+'/?border=wall');
    await page.waitForFunction(() => window.SphereLoading?.ready && SphereStageFrame.approachLabel(SphereApp.getState()).includes('maintenance wall'), null, {timeout:120000});
    const sample = await page.evaluate(async captureWalls => {
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
      // Walk up to the same stretch of concrete from both sides. Only flip the
      // addressed habitat, so a changed pixel here means the wall grew foliage.
      const gl=canvas.getContext('webgl2');
      const originalHabitats=habitats.slice(),wallGrowth=[],wallShots=[];
      for(const [near,far] of [[1,2],[2,1],[2,2]]){
        for(const side of [-1,1])for(const exterior of [false,true]){
          const z=side<0?0:station.widthM,direction=side*(exterior?-1:1);
          const eye=[station.routes[0].nearDoor[0]+146,5,z-direction*8];
          function wallPixels(){
            view.draw(station,eye,direction>0?0:Math.PI,0,0,false,1);
            const pixels=new Uint8Array(160*100*4);
            gl.readPixels((canvas.width-160)>>1,(canvas.height-100)>>1,160,100,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
            return pixels;
          }
          habitats.splice(0,2,1,1);
          const plain=wallPixels();
          habitats.splice(0,2,near,far);
          const planted=wallPixels();
          let changed=0;
          for(let i=0;i<plain.length;i+=4){
            if(Math.max(Math.abs(plain[i]-planted[i]),Math.abs(plain[i+1]-planted[i+1]),
              Math.abs(plain[i+2]-planted[i+2]))>=4)changed++;
          }
          wallGrowth.push({near,far,side,exterior,changed});
          if(captureWalls && near===1 && far===2)wallShots.push(canvas.toDataURL('image/png').split(',')[1]);
        }
      }
      habitats.splice(0,2,...originalHabitats);
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
      const aerialChanges=[];
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
      // Compare the change between moving frames to a 4x-per-axis rendering.
      // This catches subpixel lights that blink but have the right average colour.
      const width=512,height=320,read=document.createElement('canvas');
      read.width=width;read.height=height;
      const ctx=read.getContext('2d',{willReadFrequently:true});
      ctx.imageSmoothingQuality='high';
      const roofSweeps=[];
      const sweeps=[
        {name:'valve ceiling',eye:[station.routes[0].nearDoor[0]-1.8,1.72,42.3],yaw:-.22,pitch:.05},
        {name:'door ceiling',eye:[station.routes[3].farDoor[0],1.7,station.widthM+4],yaw:Math.PI+.017,pitch:.035},
        // Look along the 45 m exposed edge at walking eye height above the yard roof.
        {name:'crane well liner',eye:[11510,station.roofM+45+1.7,station.widthM/2+1518.6],
          yaw:1.72,pitch:-.045,dx:.21*Math.cos(1.72),dz:-.21*Math.sin(1.72),dyaw:.00037,rect:[179,267,28,43]}
      ];
      for(const {name,eye,yaw,pitch,dx=.12,dz=0,dyaw=.00025,rect=[96,16,316,118]} of sweeps){
        let previous=null,squared=0,detail=0,samples=0;
        for(let step=0;step<8;step++){
          const position=[eye[0]+step*dx,eye[1],eye[2]+step*dz];
          const frames=[1,4].map(scale=>{
            canvas.style.width=width*scale+'px';canvas.style.height=height*scale+'px';
            view.draw(station,position,yaw+step*dyaw,pitch,44100,false,1);
            ctx.drawImage(canvas,0,0,width,height);
            return ctx.getImageData(...rect).data;
          });
          const delta=new Int16Array(frames[0].length);
          for(let i=0;i<delta.length;i++){
            if((i&3)===3)continue;
            delta[i]=frames[0][i]-frames[1][i];
            if(previous){
              squared+=(delta[i]-previous[i])**2;samples++;
              if(i>=rect[2]*4)detail+=Math.abs(frames[0][i]-frames[0][i-rect[2]*4]);
            }
          }
          previous=delta;
        }
        roofSweeps.push({name,motionRms:Math.sqrt(squared/samples),detail:detail/samples});
      }
      canvas.style.width='640px';canvas.style.height='400px';
      view.draw(station,[door[0],1.7,door[2]-2.5],0,0,0,false,1);
      view.dispose();
      // A 2 m thick maintenance wall spans 168 km between the halls. Move along
      // its Meadow face and compare the shared 5 cm near plane with a more precise
      // 10 m reference. The sampled wall stays over 300 m away in both projections.
      const {linkHalfM}=await import('./packs/border-transport/0.10.0/district.mjs');
      const shared=makeView(canvas,{district:d,shared:true});
      shared.load(station);
      gl.depthFunc(gl.LESS);
      gl.clearColor(1,0,1,1);
      const wallPixels=(east,near)=>{
        gl.depthMask(true);
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        shared.draw(station,[east,37,station.widthM/2-linkHalfM-1-410],.25,0,44101,false,1,{near,focal});
        const pixels=new Uint8Array(192*48*4);
        gl.readPixels(Math.floor(w/2)-96,Math.floor(h/2),192,48,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        return pixels;
      };
      let squared=0,count=0,covered=0;
      for(let step=0;step<8;step++){
        const east=48700+step*1.4,ref=wallPixels(east,10),actual=wallPixels(east,.05);
        for(let i=1;i<ref.length;i+=4){
          squared+=(actual[i]-ref[i])**2;count++;
          if(ref[i]>10 && ref[i]<200)covered++;
        }
      }
      // A steep view across the shoulders should see paving, retaining walls,
      // and ramp all the way down. Magenta is the cleared exterior backdrop.
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const cutX=station.routes[2].nearDoor[0]+station.routes[2].deckWidthM/2;
      shared.draw(station,[cutX,180,station.widthM*.7],Math.PI/4,-1,44101,false,1,{focal});
      const cut=new Uint8Array(w*h*4);
      gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,cut);
      for(let i=0;i<cut.length;i+=4){
        if(cut[i]===255 && cut[i+1]===0 && cut[i+2]===255)throw Error('Outdoor background leaked through the heavy trench');
      }
      const wallDepthRms=Math.sqrt(squared/count);
      const error=gl.getError();
      shared.dispose();canvas.remove();
      const camera={eastM:site.x+64000,northM:5600,altitudeM:14300,yaw:1.5,pitch:.04,mode:'flight'};
      SphereApp.setState({...geo.mainPose(SphereApp.getState(),item,camera,SphereAtlas,SphereWorld),fov:80});
      SphereApp.draw();
      return {shots,wallGrowth,wallShots,error,nativeError,habitats,aerialChanges,swappedDoor,ceilingDelta,roofSweeps,wallDepthRms,wallCoverage:covered/count};
    },!!process.env.SPHERE_BORDER_OUTPUT);
    assert.equal(sample.error,0);
    console.log('Wall growth changed pixels',JSON.stringify(sample.wallGrowth));
    if(process.env.SPHERE_BORDER_OUTPUT){
      const out=process.env.SPHERE_BORDER_OUTPUT;
      fs.mkdirSync(out,{recursive:true});
      ['meadow-inside','meadow-outside','jungle-inside','jungle-outside'].forEach((name,i)=>
        fs.writeFileSync(path.join(out,'wall-'+name+'.png'),Buffer.from(sample.wallShots[i],'base64')));
    }
    for(const {near,far,side,exterior,changed} of sample.wallGrowth){
      const jungleExterior=exterior && (side<0?near:far)===2;
      assert(jungleExterior?changed>500:changed===0,
        `Wall growth for habitats [${near},${far}] on ${side<0?'near':'far'} ${exterior?'exterior':'interior'} changed ${changed} pixels`);
    }
    assert.deepEqual(sample.habitats,[1,2],'Seed 713 must open onto Meadow and native Super Jungle in canonical order');
    assert.notEqual(sample.shots[0],sample.shots[1]);
    assert.notEqual(sample.shots[1],sample.swappedDoor,'Changing the outside biome must change the view through the same jamb');
    assert(sample.aerialChanges.every(changed=>changed===0),'Doorway sky leaked into the aerial approach: '+sample.aerialChanges);
    assert.equal(sample.nativeError,0);
    assert(sample.wallCoverage>.99,'The moving depth comparison missed the wall');
    assert(sample.wallDepthRms<1,'The Meadow wall varies with depth precision: '+sample.wallDepthRms+'/255');
    assert(sample.ceilingDelta<15,'Native hall ceiling diverged from the enclosed station: '+sample.ceilingDelta+'/255');
    for(const sweep of sample.roofSweeps){
      assert(sweep.motionRms<2.5,sweep.name+' shimmered in motion: '+sweep.motionRms+'/255');
      if(sweep.name!=='crane well liner')assert(sweep.detail>1.8,sweep.name+' lost its visible girders');
    }
    const out=process.env.SPHERE_BORDER_OUTPUT;
    if(out){
      fs.mkdirSync(out,{recursive:true});
      sample.shots.forEach((data,i)=>fs.writeFileSync(path.join(out,'door-'+i+'.jpg'),Buffer.from(data,'base64')));
      await page.locator('#viewport').screenshot({path:path.join(out,'habitat-flight.jpg'),type:'jpeg',quality:87});
    }
    console.log('Door habitats',sample.habitats,'WebGL error',sample.error,'interior ceiling delta',sample.ceilingDelta,'moving roof',sample.roofSweeps);
  }finally{await browser.close();await host.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
