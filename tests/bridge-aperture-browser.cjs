'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const {executable}=require('./support/biome-browser.cjs');

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:executable()});
  try {
    const page=await browser.newPage();
    const source=fs.readFileSync(require.resolve('../packs/kit/bridge-biome.mjs'),'utf8');
    await page.route('http://bridge.test/**',route=>route.fulfill(
      route.request().url().endsWith('.mjs')?{contentType:'text/javascript',body:source}:
        {contentType:'text/html',body:'<canvas width="400" height="200"></canvas>'}
    ));
    await page.goto('http://bridge.test/');
    const result=await page.evaluate(async()=>{
      const {createBridgeBiome}=await import('./bridge-biome.mjs');
      const gl=document.querySelector('canvas').getContext('webgl2',{antialias:false});
      const program=gl.createProgram();
      for(const [type,source] of [[gl.VERTEX_SHADER,`#version 300 es
uniform float depth;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
gl_Position=vec4(p*2.-1.,depth*2.-1.,1.);}`],[gl.FRAGMENT_SHADER,`#version 300 es
precision highp float;
uniform vec3 color;out vec4 frag;
void main(){frag=vec4(color,1.);}`]]) {
        const shader=gl.createShader(type);
        gl.shaderSource(shader,source); gl.compileShader(shader);
        gl.attachShader(program,shader); gl.deleteShader(shader);
      }
      gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
      function fill(depth,color) {
        gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.useProgram(program);
        gl.uniform1f(gl.getUniformLocation(program,'depth'),depth);
        gl.uniform3fv(gl.getUniformLocation(program,'color'),color);
        gl.drawArrays(gl.TRIANGLES,0,3);
      }
      let clock=1.01,animated=true,resolved=0,clockReads=0;
      const bridge=createBridgeBiome(gl,{createProvider:()=>({
        draw(){gl.clear(gl.DEPTH_BUFFER_BIT);fill(.2,[0,1,0]);return {animated};},dispose(){}
      })});
      const camera={eye:[0,2,0],right:[1,0,0],up:[0,1,0],forward:[0,0,1],
        focal:[1,2],width:400,height:200};
      const aperture={key:'large',xMin:-2,xMax:2,yMin:0,yMax:4,z:10};
      const scene=()=>{resolved++;return {windTime:clock};};
      const render=(options={})=>bridge.draw({camera,aperture,scene,direct:1,near:false,
        windTime:()=>{clockReads++;return clock;},...options});
      render();
      const watched=bridge.watchWind;
      clock=1.24; render();
      // A rotation about the same eye reprojects the old picture.
      camera.forward=[Math.sin(.02),0,Math.cos(.02)]; camera.right=[Math.cos(.02),0,-Math.sin(.02)];
      render();
      const unexpired=bridge.stats.captureCount;
      clock=1.26; render(); render(); // freeze in the same tick
      const active=bridge.stats.captureCount;
      aperture.key='tiny'; aperture.z=100; render();
      let reads=clockReads;
      clock=3; render();
      const tiny=[bridge.watchWind,bridge.stats.captureCount,clockReads-reads];
      aperture.key='static'; aperture.z=10; animated=false; render();
      reads=clockReads; clock=9; render();
      const still=[bridge.watchWind,bridge.stats.captureCount,clockReads-reads];
      const resolvedPictures=resolved;
      const pixels=[];
      for(const [sharedExteriorDepth,depth] of [[true,.8],[true,.05],[false,.8]]) {
        render({exterior:true,near:true,sharedExteriorDepth});
        fill(depth,[1,0,0]);
        const pixel=new Uint8Array(4);
        gl.readPixels(100,75,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
        pixels.push([...pixel]);
      }
      bridge.dispose();
      // The Main renderer may already have opaque foreground and a nondefault
      // colour/depth target. Test a station picture behind that foreground.
      const target=gl.createFramebuffer(),color=gl.createRenderbuffer(),depth=gl.createRenderbuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER,target);
      for(const [buffer,format,attachment] of [[color,gl.RGBA8,gl.COLOR_ATTACHMENT0],[depth,gl.DEPTH_COMPONENT24,gl.DEPTH_ATTACHMENT]]){
        gl.bindRenderbuffer(gl.RENDERBUFFER,buffer);gl.renderbufferStorage(gl.RENDERBUFFER,format,400,200);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER,attachment,gl.RENDERBUFFER,buffer);
      }
      const photograph=createBridgeBiome(gl,{depthTestPicture:true,createProvider:()=>({
        draw(){fill(.1,[.5,.5,.5]);},dispose(){}
      })});
      const shared=[];
      const sample=x=>{const p=new Uint8Array(4);gl.readPixels(x,100,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p];};
      camera.forward=[0,0,1];camera.right=[1,0,0];camera.logDepth=[1,10];
      for(const linear of [false,true]){
        camera.linear=linear;gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        fill(.9,[0,0,1]);gl.enable(gl.SCISSOR_TEST);gl.scissor(198,40,24,140);
        fill(.2,[1,0,0]);gl.disable(gl.SCISSOR_TEST);
        photograph.draw({camera,aperture,near:false,scene:{},direct:1,framebuffer:target});
        shared.push([sample(190),sample(205),sample(300),gl.getParameter(gl.FRAMEBUFFER_BINDING)===target]);
      }
      photograph.dispose();gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      gl.deleteRenderbuffer(color);gl.deleteRenderbuffer(depth);gl.deleteFramebuffer(target);gl.deleteProgram(program);
      return {watched,unexpired,active,tiny,still,resolvedPictures,pixels,
        shared,released:bridge.stats.residentBytes,error:gl.getError()};
    });
    assert.equal(result.watched,true);
    assert.equal(result.unexpired,1);
    assert.equal(result.active,2);
    assert.deepEqual(result.tiny,[false,3,0]);
    assert.deepEqual(result.still,[false,4,0]);
    assert.equal(result.resolvedPictures,4);
    assert.deepEqual(result.pixels,[[0,255,0,255],[255,0,0,255],[255,0,0,255]]);
    assert.equal(result.released,0);
    for(const [photo,foreground,background,bound] of result.shared){
      assert.deepEqual(foreground,[255,0,0,255]);assert.deepEqual(background,[0,0,255,255]);assert(bound);
      assert.equal(photo[0],photo[1]);assert.equal(photo[1],photo[2]);
    }
    assert(Math.abs(result.shared[0][0][0]-128)<=1 && result.shared[1][0][0]<result.shared[0][0][0]/2);
    assert.equal(result.error,0);
    console.log('Bridge picture animation, reprojection and shared exterior depth passed');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
