'use strict';
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {session, executable} = require('./support/biome-browser.cjs');

(async () => {
  const host = await session(), browser = await chromium.launch({headless:true,executablePath:executable()});
  try {
    const page = await browser.newPage();
    await host.attach(page);
    await page.route(host.origin+'/roof-test',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));
    await page.goto(host.origin+'/roof-test');
    const results=await page.evaluate(async () => {
      const [{districtFor},{generateStation},{makeView},{makeMeadowDoor},geo,{Renderer},{initialState,GROUND_DATUM}]=await Promise.all([
        import('/packs/border-transport/0.10.0/survey.mjs'),import('/packs/border-transport/0.10.0/station.mjs'),
        import('/packs/border-transport/0.10.0/view.mjs'),import('/packs/border-transport/0.10.0/meadow-door.mjs'),
        import('/geographic-flight.js'),import('/packs/infinite-meadow/1.3.0/renderer.js'),import('/packs/infinite-meadow/1.3.0/model.js')]);
      const district=districtFor('sphere-ed6a59ab491a9a08','r10c0','r10c1',149597870700);
      const site=district.sites.find(s=>s.bay===0),station=generateStation(site.address);
      const row=geo.meadowStations(district,SphereAtlas.byId('r10c0')).find(r=>r.site.bay===0);
      const settings=initialState(),fov=103,w=640,h=360;
      const descriptor={side:-1,sceneFor(eye,yaw,pitch){
        const [x,y,z]=eye,northM=z-station.widthM/2;
        const pose=geo.stationToMeadowPose(row,{eastM:site.x+x,northM,altitudeM:y+geo.meadowDatum,yaw,pitch,mode:'flight'});
        return {pose,station,apron:{x,z:northM,row},settings,windTime:0};
      }};
      function canvas(){
        const c=document.createElement('canvas');c.width=w;c.height=h;c.style.width=w+'px';c.style.height=h+'px';document.body.append(c);return c;
      }
      const border=canvas(),meadow=canvas(),native=new Renderer(meadow,{horizontalFov:fov});
      let destination=descriptor;
      const view=makeView(border,{district,habitats:[1,2],cavityBackdrop:true,createDoor:g=>makeMeadowDoor(g,()=>destination,()=>{},()=>0)});
      view.load(station);
      const gl=border.getContext('webgl2'),focal=w/h/Math.tan(fov*Math.PI/360);
      function band(g,x,y,width,height){
        const a=new Uint8Array(width*height*4);g.readPixels(x,y,width,height,g.RGBA,g.UNSIGNED_BYTE,a);return a;
      }
      function error(a,b){
        let sum=0;for(let i=0;i<a.length;i++)if(i%4!==3)sum+=Math.abs(a[i]-b[i]);
        return +(sum/(a.length*.75)).toFixed(3);
      }
      const samples=[];
      for(const [eye,yaw,edge] of [
        [[15998.4,1746.7,.8],-Math.PI*.49,'left'],[[15954.1,1868.6,-332],Math.PI*.51,'right']
      ])for(const direct of [1,0]){
        const pitch=-.11,scene=descriptor.sceneFor(eye,yaw,pitch);
        const draw=()=>view.draw(station,eye,yaw,pitch,0,false,direct,{focal});
        draw();
        const firstPending=view.bridgePending;
        for(let i=0;i<100 && view.bridgePending;i++){await new Promise(r=>setTimeout(r,20));draw();}
        native.stationApron=scene.apron;native.stationDatum=GROUND_DATUM;native.lightAt=()=>({direct});
        native.draw({...settings,pose:scene.pose},{version:-1,ready:false},{timing:false,inspection:'distant'});
        const x=edge==='left'?18:w-118;
        const mae=(y,height)=>error(band(gl,x,y,100,height),band(native.gl,x,y,100,height));
        samples.push({eye,yaw,direct,horizon:mae(146,38),sky:mae(250,55),ground:mae(70,36),
          firstPending,resources:view.bridge.provider,residentBytes:view.bridge.residentBytes});
      }
      // The Border canvas is composited over Main's cavity view. At altitude,
      // read the real alpha channel and check that the native colour is premultiplied.
      const eye=[15998.4,1746.7,.8],yaw=-Math.PI*.49,pitch=-.11;
      const sky=()=>Array.from(band(gl,44,280,1,1));
      view.draw(station,eye,yaw,pitch,0,false,1,{focal});
      const opaque=sky();
      view.draw(station,eye,yaw,pitch,0,false,1,{focal,groundWeight:1,airWeight:.25,vacuum:.75});
      const masked=sky();
      // A turn into another frontage must release every backdrop allocation.
      view.draw(station,[eye[0],eye[1],station.widthM+10],0,0,0,false,1,{focal});
      const released=view.bridge.provider==null;
      destination={...descriptor,doorsEnabled:false};view.refreshBridge();
      view.draw(station,eye,yaw,pitch,0,false,1,{focal});
      const neighborBackdrop=view.roofBackdropWeight;
      const [x,y,z]=station.routes[0].nearDoor;
      view.draw(station,[x,y+1.7,z-1],Math.PI,0,0,false,1,{focal});
      const neighborDoorReleased=view.bridge.provider==null;
      destination=null;view.refreshBridge();
      view.draw(station,eye,yaw,pitch,0,false,1,{focal});
      const fallback=view.roofBackdropWeight===0 && !view.bridgePending && !view.bridgeError &&
        view.bridge.provider==null && sky()[3]===255 && gl.getError()===gl.NO_ERROR;
      view.dispose();native.dispose();return {samples,opaque,masked,released,neighborBackdrop,neighborDoorReleased,fallback};
    });
    for(const r of results.samples)console.log(JSON.stringify(r));
    assert.ok(results.samples[0].firstPending,'First roof arrival must wait for the native backdrop');
    for(const r of results.samples){
      assert.ok(r.horizon<2 && r.sky<2 && r.ground<2,'Roof backdrop differs at the same survey pose: '+JSON.stringify(r));
      assert.equal(r.resources.submittedTufts,0);assert.equal(r.resources.clumpBlocks,0);
      assert.equal(r.resources.draws,2);assert.equal(r.residentBytes,0);
    }
    assert.ok(results.masked.every((v,i)=>Math.abs(v-.25*results.opaque[i])<=1),
      'Cavity-sky opacity must premultiply both color and alpha');
    assert.ok(results.released,'Leaving the Meadow half of the roof must release the backdrop');
    assert.equal(results.neighborBackdrop,1);assert.ok(results.neighborDoorReleased,'Roof residency must not activate neighboring door bridges');
    assert.ok(results.fallback,'Removing Meadow must restore the ordinary roof sky');
  } finally {await browser.close();await host.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
