'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {session,executable}=require('./support/biome-browser.cjs');
const pack=require('../packs/biome-library.json').packs.find(p=>p.id==='infinite-industry');
async function main(){
 const host=await session(),browser=await chromium.launch({headless:true,executablePath:executable()});
 try{
  const page=await browser.newPage(),base=host.origin+'/'+pack.entry.slice(0,pack.entry.lastIndexOf('/')+1);
  await page.goto(base+'manifest.json');
  const report=await page.evaluate(async base=>{
   const [{FieldView},pods,{PALETTES},{DATUM_M},{ResourceLease}]=await Promise.all(['field-view.js','pod.js','works.js','facility.js','../../runtime/v1/resources.js'].map(p=>import(base+p)));
   const canvas=document.createElement('canvas');canvas.width=canvas.height=129;
   const gl=canvas.getContext('webgl2',{antialias:false}),lease=new ResourceLease(gl,{gpuBufferBytes:201326592}),field=new FieldView(gl);
   gl.viewport(0,0,129,129);gl.enable(gl.DEPTH_TEST);
   const pose={altitudeM:DATUM_M+220,pitch:-Math.PI/2,yaw:0};
   function draw(e,n){
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);field.begin({...pose,eastM:e,northM:n},1);field.ground();
   }
   function pixel(){const rgb=new Uint8Array(4);gl.readPixels(64,64,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgb);return Array.from(rgb).slice(0,3);}
   const cases=[];
   for(const [i,j] of [[0,0],[1,-1],[-3,2],[7,5],[-45,21],[9000000,-3000000]]){
    const district=pods.district(i,j);
    for(const [a,b] of [[0,0],[1,0],[0,1],[-1,0]]){
     const pod=pods.pod(district,a,b);
     for(const h of pods.hexes(pod)){
      const [e,n]=h.center,at=pods.locate(e,n).hex;draw(e,n);
      const tint=at.waterWorks?[.35,.35,.308]:PALETTES[at.pod.temperature].ground.map(v=>v*.81);
      const fog=1-Math.exp(-220/6400),air=[.47,.55,.54];
      const expected=tint.map((v,k)=>Math.round(255*((v*.86*(1-fog)+air[k]*fog)**.53)));
      const actual=pixel();cases.push({id:at.id,error:Math.max(...actual.map((x,k)=>Math.abs(x-expected[k])))});
     }
    }
   }
   const centre=pods.pod(pods.district(0,0),-1,1).center;draw(...centre);
   const pixels=()=>{const p=new Uint8Array(129*129*4);gl.readPixels(0,0,129,129,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
   const slab=pixels();field.skyline();const first=pixels();let solidPixels=0;
   for(let i=0;i<slab.length;i+=4)if(Math.abs(slab[i]-first[i])+Math.abs(slab[i+1]-first[i+1])+Math.abs(slab[i+2]-first[i+2])>24)solidPixels++;
   const glError=gl.getError();field.dispose();const live=lease.inspect();lease.dispose();
   return {checked:cases.length,worst:cases.sort((a,b)=>b.error-a.error)[0],solidPixels,glError,live:live.liveResources,bytes:live.bufferBytes};
  },base);
  assert(report.worst.error<=3,JSON.stringify(report));assert(report.solidPixels>300,JSON.stringify(report));
  assert.equal(report.glError,0);assert.equal(report.live,0);assert.equal(report.bytes,0);
  await page.goto(base+'index.html');
  await page.waitForFunction(()=>window.SphereBiome?.inspect().frames>95,null,{timeout:90000});
  const parity=await page.evaluate(async()=>{
   document.querySelector('#pauseProcess').click();
   const gl=document.querySelector('#world').getContext('webgl2'),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
   const scissor=gl.scissor,results=[];
   const frames=async n=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);};
   const read=()=>{const a=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
   for(const dy of [0,125,-200]){
    if(dy){
     // Use the normal pitch keys. The run covers the ground, the level horizon and the sky above it.
     const code=dy>0?'ArrowDown':'ArrowUp';window.dispatchEvent(new KeyboardEvent('keydown',{code}));await frames(Math.abs(dy)/3);
     window.dispatchEvent(new KeyboardEvent('keyup',{code}));
    }
    await frames(42);const limited=read();gl.scissor=()=>scissor.call(gl,0,0,w,h);await frames(3);
    const full=read();gl.scissor=scissor;let changed=0;
    for(let i=0;i<full.length;i+=4)if(Math.max(Math.abs(full[i]-limited[i]),Math.abs(full[i+1]-limited[i+1]),Math.abs(full[i+2]-limited[i+2]))>2)changed++;
    results.push({pitch:SphereBiome.pose().pitch,changed});
   }
   return results;
  });
  assert(parity.every(r=>r.changed===0),JSON.stringify(parity));
  console.log('PASS opaque ground and horizon clipping agree with the full shell',parity);
  console.log('PASS addressed district colours, visible first skyline and renderer disposal',report);
 }finally{await browser.close();await host.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
