'use strict';
// Run this same camera strip from either checkout for a matched material comparison.
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const {session, executable} = require(path.resolve('tests/support/biome-browser.cjs'));

async function main() {
  const directory = path.resolve(process.argv[2]);
  fs.mkdirSync(directory, {recursive:true});
  const host = await session();
  const browser = await chromium.launch({executablePath:executable(), headless:true});
  try {
    const context = await browser.newContext({viewport:{width:960,height:540}});
    await host.attach(context);
    const page = await context.newPage();
    await page.goto(host.origin + '/packs/kit/border-profile.js');
    const observations = await page.evaluate(async () => {
      const base = '/packs/border-transport/0.10.0/';
      const {addressOf,generateStation} = await import(base+'station.mjs');
      const {districtFor} = await import(base+'survey.mjs');
      const {makeView,stationMesh,freightMesh} = await import(base+'view.mjs');
      const key='sphere-ed6a59ab491a9a08', a='r10c0', b='r10c1', radius=149597870700;
      const station=generateStation(addressOf(key,a,b,0,radius)), district=districtFor(key,a,b,radius);
      const canvas=document.createElement('canvas');
      document.body.replaceChildren(canvas);document.body.style.margin='0';canvas.style.cssText='display:block;width:960px;height:540px';
      const view=makeView(canvas,{district}), gl=canvas.getContext('webgl2');
      view.load(station);
      const assemblyMs=[],vertices=stationMesh(station,district).length/9;
      const geometryBytes=view.geometryBytes??(vertices*9+freightMesh(station.traffic).length)*4;
      for(let i=0;i<13;i++){
        const t=performance.now();stationMesh(station,district,'geometryBytes' in view);
        if(i>=3)assemblyMs.push(performance.now()-t);
      }
      const front=station.widthM, door=station.routes[0].farDoor[0];
      const views = [
        ['look-back',[-1100,7.774,front+3610.064],-3.140144,.050178],
        ['apron',[door+28,1.7,front+140],Math.PI+.19,.045],
        ['portal',[door+1.3,1.7,front+21],Math.PI+.055,.08],
        ['gallery',[door+.35,1.7,front-4],Math.PI+.09,.045],
        ['paving',[door+5,1.7,front+78],Math.PI+.2,-.25],
        ['roof',[door+1300,station.roofM+47,front*.65],.26,-.33],
        ['bridge',[door,station.routes[0].points[2][1]+1.7,front/2],1.7,-.16]
      ];
      window.drawSample=i=>{const [,eye,yaw,pitch]=views[i];view.draw(station,eye,yaw,pitch,0,false,0);};
      const samples=[];
      const pixel=new Uint8Array(4);
      for(let run=0;run<10;run++)for(let i=0;i<views.length;i++){
        const start=performance.now();
        for(let draw=0;draw<8;draw++)window.drawSample(i);
        gl.readPixels(480,270,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
        if(run>=3)samples.push({view:views[i][0],ms:(performance.now()-start)/8});
      }
      return {views:views.map(v=>v[0]), samples, assemblyMs,vertices,geometryBytes,uploads:view.uploads, glError:gl.getError(),
        device:gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL)};
    });
    for(const [i,name] of observations.views.entries()){
      await page.evaluate(i=>window.drawSample(i),i);
      await page.locator('canvas').screenshot({path:path.join(directory,name+'.png')});
    }
    fs.writeFileSync(path.join(directory,'surfaces.json'),JSON.stringify(observations,null,2));
    console.log(observations.views.join(', '), observations.device, 'GL error', observations.glError);
    if(observations.glError)throw Error('WebGL error in station camera strip');
  } finally {await browser.close();await host.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
