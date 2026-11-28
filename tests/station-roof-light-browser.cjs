'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {session,executable}=require('./support/biome-browser.cjs');

(async()=>{
  const host=await session(),browser=await chromium.launch({headless:true,executablePath:executable()});
  try{
    const page=await browser.newPage();
    await host.attach(page.context());
    await page.goto(host.origin+'/packs/biome-library.json');
    const result=await page.evaluate(async capture=>{
      const base='/packs/border-transport/0.10.0/';
      const [{makeView},{districtFor},{generateStation},{layerWeight}]=await Promise.all([
        import(base+'view.mjs'),import(base+'survey.mjs'),import(base+'station.mjs'),import('/packs/kit/atmosphere.js')]);
      const district=districtFor('sphere-ed6a59ab491a9a08','r10c0','r10c1',149597870700);
      const station=generateStation(district.sites.find(s=>s.bay===0).address),mid=station.widthM/2;
      if(station.widthM!==48000 || station.roofM!==1700)throw Error('Expected the surveyed seed 713 roof corner');
      const width=640,height=360,focal=1.6,shots={},scenes=[];
      // Both hosts draw the same structure over black; every occupied pixel is steel or concrete.
      const renderers=[false,true].map(shared=>{
        const canvas=document.createElement('canvas');
        canvas.width=width;canvas.height=height;
        canvas.style.cssText='position:fixed;left:0;top:0;width:640px;height:360px';
        document.body.append(canvas);
        const view=makeView(canvas,{shared,district,habitats:[1,2]});
        view.load(station);
        return {shared,canvas,view,gl:canvas.getContext('webgl2')};
      });
      // Remove only the upper crane members for a visibility measurement. The
      // roof, shaft walls, and all depth-tested occluders still draw normally.
      const {stationMesh,mesh}=await import(base+'view.mjs');
      const {bayStart,bayEnd,bayHalf}=await import(base+'freight-bay.mjs');
      const stripCranes=makeView(renderers[1].canvas,{shared:true,district,habitats:[1,2],buildHall(s,d,packed){
        const all=stationMesh(s,d,packed),filtered=all.slice(0,6);
        for(let i=6;i<all.length;i+=18){
          const corners=[0,3,6,9].map(offset=>all.slice(i+offset,i+offset+3));
          const overWell=corners.every(([x,,z])=>x>bayStart && x<bayEnd && Math.abs(z-mid)<=bayHalf);
          if(!overWell || corners.every(([,y])=>y<=s.roofM+45))filtered.push(...all.slice(i,i+18));
        }
        return filtered;
      }});
      stripCranes.load(station);
      for(const [position,x,z,h] of [['deck',15998.4,.8,1746.7],['outside',15954.1,-332,1868.6]]){
        const eye=[x,h,z],near=Math.max(.05,(h-station.roofM)*.015);
        for(const [heading,yaw,pitch] of [['link',1.39,-.018],['cranes',Math.atan2(8000-x,mid-z),-.032],['end',.76,-.17]]){
          const name=position+'-'+heading;
          const lens=heading==='end'?width/height/Math.tan(103*Math.PI/360):focal;
          const frames=renderers.map(({shared,canvas,view,gl})=>{
            gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
            // Border passes its roof exposure to its sky; Meadow owns an ordinary exterior canvas.
            const vacuum=shared || z<0?0:layerWeight(-400,0,-Math.min(16000-x,z));
            view.draw(station,eye,yaw,pitch,44101,false,1,{near,focal:lens,vacuum,groundWeight:0,airWeight:0});
            const pixels=new Uint8Array(4*width*height);
            gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
            if(capture)shots[name+'-'+(shared?'meadow':'border')]=canvas.toDataURL('image/png').split(',')[1];
            if(gl.getError()!==gl.NO_ERROR)throw Error('Roof readback failed');
            return pixels;
          });
          const [a,b]=frames;
          let sum=0,geometry=0,silhouette=0,changed=0,horizonSum=0,horizonCount=0;
          for(let i=0;i<a.length;i+=4){
            const covered=p=>p[i]+p[i+1]+p[i+2]>32;
            if(covered(a)!==covered(b))silhouette++;
            if(!covered(a)||!covered(b))continue;
            const dr=a[i]-b[i],dg=a[i+1]-b[i+1],db=a[i+2]-b[i+2];
            sum+=dr*dr+dg*dg+db*db;geometry++;
            const col=(i/4)%width,row=Math.floor(i/(4*width));
            if(heading==='end' && col>.08*width && col<.29*width && row>.50*height && row<.68*height){
              horizonSum+=Math.abs(dr)+Math.abs(dg)+Math.abs(db);horizonCount++;
            }
            if(Math.max(Math.abs(dr),Math.abs(dg),Math.abs(db))>=5)changed++;
          }
          let cranePixels=null;
          if(heading==='cranes'){
            const {gl}=renderers[1];
            gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
            stripCranes.draw(station,eye,yaw,pitch,44101,false,1,{near,focal});
            const omitted=new Uint8Array(b.length);
            gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,omitted);
            cranePixels=0;
            for(let i=0;i<b.length;i+=4)
              if(Math.max(Math.abs(omitted[i]-b[i]),Math.abs(omitted[i+1]-b[i+1]),Math.abs(omitted[i+2]-b[i+2]))>=5)cranePixels++;
          }
          scenes.push({name,geometry,silhouette,changed,cranePixels,horizonCount,
            horizonMae:horizonCount?horizonSum/(3*horizonCount):null,rms:Math.sqrt(sum/(3*geometry))});
        }
      }
      stripCranes.dispose();renderers.forEach(r=>r.view.dispose());
      // Equal-distance concrete panels. Translate the eye and panel together
      // so the ray lies over the roof, crosses the roof edge, or stays outside.
      const {canvas,gl}=renderers[0];
      const panels=[[-14000,2000],[-27000,3000],[-50000,4000]];
      const probe=makeView(canvas,{shared:true,district,habitats:[1,2],buildHall(){
        const m=mesh(true);
        for(const [start,z] of panels){
          const x=start+22000;
          m.quad([x,2000,z-180],[x,2400,z-180],[x,2400,z+180],[x,2000,z+180],[.28,.33,.36]);
        }
        return m.data;
      }});
      probe.load(station);
      const pathLight=panels.map(([x,z])=>{
        gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        probe.draw(station,[x,2200,z],Math.PI/2,0,44101,false,1,{near:2,focal});
        const pixel=new Uint8Array(4);
        gl.readPixels(width/2,height/2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
        return [...pixel.slice(0,3)];
      });
      probe.dispose();
      return {scenes,shots,pathLight};
    },!!process.env.SPHERE_BORDER_OUTPUT);
    console.log(JSON.stringify({scenes:result.scenes,pathLight:result.pathLight}));
    const [vacuum,mixed,outside]=result.pathLight;
    assert(vacuum.every((v,i)=>v+12<mixed[i] && mixed[i]+12<outside[i]),
      'A ray spent entirely above the roof must stay clear, and a partial outdoor ray must collect partial haze');
    if(process.env.SPHERE_BORDER_OUTPUT){
      fs.mkdirSync(process.env.SPHERE_BORDER_OUTPUT,{recursive:true});
      for(const [name,shot] of Object.entries(result.shots))
        fs.writeFileSync(path.join(process.env.SPHERE_BORDER_OUTPUT,name+'.png'),Buffer.from(shot,'base64'));
    }
    for(const scene of result.scenes){
      if(scene.name.endsWith('-end'))assert(scene.horizonCount>100 && scene.horizonMae<3,
        scene.name+' changed the distant steel along the left horizon');
      if(scene.cranePixels!==null)assert(scene.cranePixels>50,'The surveyed crane crown must be visible at both heights');
      assert(scene.geometry>1000,'Photograph must contain resolved station structure');
      assert(scene.rms<1.5,scene.name+' changed the appearance of solid geometry on handoff');
      assert(scene.silhouette<500,scene.name+' lost geometric coverage on handoff');
    }
  }finally{await browser.close();await host.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
