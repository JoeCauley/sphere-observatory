// Exercise the same shared WebGL context and walking near plane as the Meadow.
// The contrasting backdrop makes double-blended, depth-coincident faces observable.
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {session,executable}=require('./support/biome-browser.cjs');

async function main(){
  const host=await session(),browser=await chromium.launch({headless:true,executablePath:executable()});
  try{
    const context=await browser.newContext();
    await host.attach(context);
    const page=await context.newPage();
    await page.goto(host.origin+'/packs/biome-library.json');
    const result=await page.evaluate(async()=>{
      const base='/packs/border-transport/0.10.0/';
      const [{makeView},{districtFor},{generateStation},{meadowStationVisibility}]=await Promise.all(
        ['view.mjs','survey.mjs','station.mjs','district.mjs'].map(file=>import(base+file)));
      const district=districtFor('sphere-0000000000000017','r10c0','r10c1',149597870700);
      const station=generateStation(district.sites[1].address),mid=station.widthM/2;
      const canvas=document.createElement('canvas');
      canvas.width=480;canvas.height=216;
      const gl=canvas.getContext('webgl2',{stencil:true,antialias:true,alpha:false});
      const view=makeView(canvas,{shared:true,district}),background=[46,77,124];
      function sweep(point,start,end,steps,exteriorOnly){
        const frames=[];
        view.load(station,exteriorOnly);
        for(let i=0;i<=steps;i++){
          const [x,y,z,pitch]=point(start+(end-start)*i/steps);
          const {opacity}=meadowStationVisibility(district,x,z,y);
          gl.clearColor(...background.map(v=>v/255),1);
          gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
          if(opacity>0)view.draw(station,[x,y,z+mid],0,pitch,17,false,1,{near:.05,focal:1.5,opacity});
          const pixel=new Uint8Array(4);
          gl.readPixels(240,108,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
          frames.push([...pixel.slice(0,3)]);
        }
        const largest=Math.max(...frames.slice(1).flatMap((rgb,i)=>rgb.map((v,c)=>Math.abs(v-frames[i][c]))));
        return {first:frames[0],last:frames.at(-1),largest};
      }
      // Cross the old 20 km horizontal and 30 km vertical cutoffs.
      const link=range=>[(district.sites[0].x+district.sites[1].x)/2,station.roofM*.78,-1900-range,0];
      const roof=range=>[0,station.roofM+45+range,-.1*mid,-Math.PI/2];
      const connector=sweep(link,16500,19900,18,false),overhead=sweep(roof,26000,30500,32,false);
      const fade=sweep(roof,64000,164000,160,true);
      view.dispose();
      return {background,connector,overhead,fade};
    });
    for(const pass of [result.connector,result.overhead]){
      assert.notDeepEqual(pass.first,result.background);
      assert.notDeepEqual(pass.last,result.background);
      assert(pass.largest<=5,'The rendered surface jumped at its former cutoff');
    }
    assert.notDeepEqual(result.fade.first,result.background);
    assert.deepEqual(result.fade.last,result.background);
    assert(result.fade.largest<=5,'Depth-coincident faces blended more than once at long range');
    console.log(JSON.stringify(result));
  }finally{await browser.close();await host.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
