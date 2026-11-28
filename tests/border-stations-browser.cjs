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
      [gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;\n'+SphereBiomeSurface.glsl(SphereAtlas)+'\nuniform float sizeKm,deltaKm,localFrame;out vec4 outputColor;void main(){float lat=.23,lon=deltaKm/(uAtlasRadiusKm*cos(lat));vec3 q=vec3(cos(lat)*cos(lon),sin(lat),cos(lat)*sin(lon));outputColor=vec4(installedBiomeMaterial(vec3(.72,.69,.61),q,vec3(deltaKm,0.,0.),sizeKm/uAtlasRadiusKm,localFrame),1.);}']]){
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
    const sample=(px,offset)=>{gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform1f(u('sizeKm'),px);gl.uniform1f(u('deltaKm'),offset);gl.drawArrays(gl.TRIANGLES,0,3);const b=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,b);return Array.from(b);};
    const rgb=[2,96,768,12288].map(px=>sample(px,0));
    const ground=sample(2,200000);
    gl.uniform1f(u('localFrame'),543);gl.uniform4f(u('uAtlasLocalGrid'),1e6,1e6,1e6,8000);
    gl.uniform4f(u('uAtlasLocalEast'),1,0,0,1e6);gl.uniform4f(u('uAtlasLocalNorth'),0,1,0,1e6);
    gl.uniform4f(u('uTransportWidths'),24,24,24,1);
    const bay=sample(.02,15.9),shoulder=sample(.02,16.1);
    gl.uniform1f(u('uAtlasSteelReach'),1450);
    const underMesh=sample(.02,15.9);
    gl.uniform4f(u('uSurveyPaving'),0,24,3.5,16);
    gl.uniform2f(u('uAtlasLocalHalls'),0,24.5);
    gl.uniform3f(u('uSurveyDoors'),-2.6,-1.82,1.05);gl.uniform3f(u('uSurveyHalfWidths'),.007,.014,.505);
    const paving=sample(.001,1.05),soil=sample(.001,1.60);
    return {rgb,ground,bay,shoulder,underMesh,paving,soil,error:gl.getError()};
  });
}
// A small section beneath a boot must resolve fine detail, average to a stable
// value at flight scale and retain the pattern when a 32 km wall tile rebases.
async function floorSamples(page){
  return page.evaluate(async()=>{
    const {surfaceNoise}=await import('/packs/kit/outfall-wall.mjs');
    const {freightFloorGLSL}=await import('/packs/kit/freight-floor.mjs');
    const canvas=document.createElement('canvas');canvas.width=canvas.height=48;
    const gl=canvas.getContext('webgl2',{antialias:false}),program=gl.createProgram();
    for(const [type,source] of [[gl.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}'],
      [gl.FRAGMENT_SHADER,`#version 300 es
      precision highp float;uniform int kind;uniform vec2 origin;uniform float footprint;out vec4 color;
      ${surfaceNoise}${freightFloorGLSL}
      void main(){vec2 delta=gl_FragCoord.xy*.003,uv=origin+delta,fine=mod(origin,32.)+delta,pixel=vec2(footprint);
        vec3 base=vec3(.45),c=kind==0?pouredFloor(base,uv,fine,pixel):treadFloor(base,uv,fine,pixel);
        color=vec4(c,1.);}`]]){
      const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program,shader);gl.deleteShader(shader);
    }
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);gl.viewport(0,0,48,48);
    function scan(kind,pixel,offset){
      gl.uniform1i(gl.getUniformLocation(program,'kind'),kind);gl.uniform1f(gl.getUniformLocation(program,'footprint'),pixel);
      gl.uniform2f(gl.getUniformLocation(program,'origin'),1.25+offset,2.25+offset);
      gl.drawArrays(gl.TRIANGLES,0,3);const data=new Uint8Array(48*48*4);gl.readPixels(0,0,48,48,gl.RGBA,gl.UNSIGNED_BYTE,data);
      return data.filter((_,i)=>i%4===0);
    }
    const span=a=>Math.max(...a)-Math.min(...a);
    return [0,1].map(kind=>{
      const walk=scan(kind,.003,0),far=scan(kind,2,0),rebase=scan(kind,.003,32000);
      return {walk:span(walk),far:span(far),shift:walk.reduce((v,x,i)=>Math.max(v,Math.abs(x-rebase[i])),0)};
    });
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
    assert.equal(shader.paving[3],0,'Native ground yields the wide paved approach to the detailed station');
    assert.equal(shader.soil[3],255,'The Jungle still draws the adjacent soil');
    assert.notDeepEqual(shader.bay,shader.shoulder,'The shell resolves a 200 m crossing of the surveyed hall end at AU radius');
    assert.deepEqual(shader.underMesh,shader.shoulder,'Only the physical roof draws in the resident survey');
    assert(contrast[0]>60 && contrast[2]<.3*contrast[0] && contrast[3]<=2,'Main roof recedes as its physical footprint shrinks');
    const floors=await floorSamples(page);
    for(const sample of floors){
      assert(sample.walk>=12 && sample.far<=2,'Floor relief resolves on foot and averages out in flight: '+JSON.stringify(sample));
      assert(sample.shift<=2,'Wall tile rebasing moved the tread or aggregate: '+JSON.stringify(sample));
    }
    assert.deepEqual(errors,[]);
    const geometry=r=>({fraction:r.fraction,centroidX:r.centroidX,top:r.topFraction,underside:r.undersideFraction});
    console.log(JSON.stringify({bridge:bridge.map(geometry),lane:lane.map(geometry),roofContrast8Bit:contrast,floors,reloadLocked:true,graphicsErrors:errors.length}));
  }finally{await browser.close();await service.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
