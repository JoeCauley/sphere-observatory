'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {session,executable}=require('./support/biome-browser.cjs');

async function projectedRoof(page){
  return page.evaluate(async()=>{
    const source=await fetch('/biome-surface.js').then(r=>r.text());
    // Use Main's shipped shader, including its ownership textures, through its public assembly API.
    if(!window.SphereBiomeSurface)(0,eval)(source);
    const gl=document.createElement('canvas').getContext('webgl2',{antialias:false});
    const program=gl.createProgram();
    for(const [type,code] of [[gl.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}'],
      [gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;\n'+SphereBiomeSurface.glsl(SphereAtlas)+'\nuniform float sizeKm,deltaKm;out vec4 outputColor;void main(){float lat=.23,lon=deltaKm/(uAtlasRadiusKm*cos(lat));vec3 q=vec3(cos(lat)*cos(lon),sin(lat),cos(lat)*sin(lon));outputColor=vec4(installedBiomeMaterial(vec3(.72,.69,.61),q,sizeKm/uAtlasRadiusKm,0.),1.);}']]){
      const sh=gl.createShader(type);gl.shaderSource(sh,code);gl.compileShader(sh);
      if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));
      gl.attachShader(program,sh);
    }
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const u=n=>gl.getUniformLocation(program,n);
    gl.uniform1i(u('uInstalledBiomesOn'),1);gl.uniform1f(u('uAtlasRadiusKm'),149597870.7);
    gl.uniform3f(u('uAtlasAxis'),0,1,0);gl.uniform3f(u('uAtlasRight'),1,0,0);gl.uniform3f(u('uAtlasUp'),0,0,1);
    const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32F,64,3*SphereAtlas.ROWS);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.viewport(0,0,1,1);
    const sample=(px,offset)=>{gl.uniform1f(u('sizeKm'),px);gl.uniform1f(u('deltaKm'),offset);gl.drawArrays(gl.TRIANGLES,0,3);const b=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,b);return Array.from(b);};
    const rgb=[2,96,768,12288].map(px=>sample(px,0));
    const ground=sample(2,200000);
    return {rgb,ground,error:gl.getError()};
  });
}
(async()=>{
  const service=await session(),browser=await chromium.launch({executablePath:executable(),headless:true});
  try{
    const page=await browser.newPage({viewport:{width:990,height:690}});
    await service.attach(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const url=service.origin+'/studies/border-crossing/index.html';
    await page.goto(url);await page.waitForFunction(()=>window.BorderCrossingStudy);
    const query=()=>page.evaluate(()=>window.BorderCrossingStudy.inspect());
    assert.equal((await query()).locked,false);
    await page.click('#enter');await page.waitForFunction(()=>BorderCrossingStudy.inspect().locked);
    const first=await query();await page.reload();await page.waitForFunction(()=>window.BorderCrossingStudy);
    assert.deepEqual((await query()).station,first.station);
    const measure=async(view,t)=>page.evaluate(([view,t])=>{
      const pose=BorderCrossingStudy.witness(view,t);return {...pose,...BorderCrossingStudy.visibleFreight()};
    },[view,t]);
    const bridge=[],lane=[];
    for(const t of [-200,0,200]){bridge.push(await measure('bridge',t));lane.push(await measure('lane',t));}
    for(let i=0;i<bridge.length;i++){
      assert.equal(bridge[i].clock,lane[i].clock);assert.equal(bridge[i].train,lane[i].train);
      assert(bridge[i].fraction>.02 && lane[i].fraction>.02,'The actual freight geometry must be visible from both locations');
    }
    assert(bridge[2].centroidX-bridge[0].centroidX>.30);assert(lane[2].centroidX-lane[0].centroidX>.20);
    assert(bridge[1].fraction>.15 && lane[1].fraction>.18,'The lookout and refuge both expose the passing freight.');
    assert(bridge[1].topFraction>lane[1].topFraction+.10,'The bridge must reveal the upper surface of the shared load.');
    assert(lane[1].undersideFraction>bridge[1].undersideFraction,'The lane must expose the lower face of the shared load.');
    assert.equal((await query()).glError,0);
    const shader=await projectedRoof(page);
    assert.equal(shader.error,0);
    const distance=(rgb)=>Math.max(...shader.ground.slice(0,3).map((x,i)=>Math.abs(x-rgb[i])));
    const contrast=shader.rgb.map(distance);
    assert(contrast[0]>60 && contrast[2]<.3*contrast[0] && contrast[3]<=2,'Main roof recedes as its physical footprint shrinks');
    assert.deepEqual(errors,[]);
    const geometry=r=>({fraction:r.fraction,centroidX:r.centroidX,top:r.topFraction,underside:r.undersideFraction});
    console.log(JSON.stringify({bridge:bridge.map(geometry),lane:lane.map(geometry),roofContrast8Bit:contrast,reloadLocked:true,graphicsErrors:errors.length}));
  }finally{await browser.close();await service.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
