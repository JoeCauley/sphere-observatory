'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {session,executable}=require('./support/biome-browser.cjs');
(async()=>{
 const host=await session(),browser=await chromium.launch({headless:true,executablePath:executable()});
 try{
  const context=await browser.newContext();await host.attach(context);const page=await context.newPage();
  await page.goto(host.origin+'/packs/biome-library.json');await page.addScriptTag({url:'/sphere-atlas.js'});await page.addScriptTag({url:'/biome-surface.js'});
  const result=await page.evaluate(()=>{
    const A=SphereAtlas,R=149597870.7,tau=2*Math.PI,canvas=document.createElement('canvas');
    canvas.width=canvas.height=3;
    const gl=canvas.getContext('webgl2'),pr=gl.createProgram(),u=name=>gl.getUniformLocation(pr,name);
    const vs='#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0,1);}';
    const source=SphereBiomeSurface.glsl(A).replace('if(meshOwns)branchCover=0.;','return vec3(branchCover,trunkCover,0.);');
    const fs='#version 300 es\nprecision highp float;'+source+
      '\nuniform vec3 aim,offsetKm;uniform float slant;out vec4 result;void main(){vec2 dp=gl_FragCoord.xy-1.5;vec3 dx=.25*(dp.x*uAtlasLocalEast.xyz+dp.y*uAtlasLocalNorth.xyz);result=vec4(installedBiomeMaterial(vec3(0),normalize(aim+dx/uAtlasRadiusKm),offsetKm+dx,.25/uAtlasRadiusKm,slant),1.);}';
    for(const [type,text] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){
      const sh=gl.createShader(type);gl.shaderSource(sh,text);gl.compileShader(sh);
      if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));gl.attachShader(pr,sh);
    }
    gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(pr));gl.useProgram(pr);gl.viewport(0,0,3,3);
    gl.uniform1i(u('uInstalledBiomesOn'),1);gl.uniform1f(u('uAtlasRadiusKm'),R);
    gl.uniform3f(u('uAtlasRight'),1,0,0);gl.uniform3f(u('uAtlasUp'),0,0,1);gl.uniform3f(u('uAtlasAxis'),0,1,0);
    const dir=(a,l)=>[Math.cos(a)*Math.cos(l),Math.sin(a),Math.cos(a)*Math.sin(l)];
    const failures=[];let total=0;
    for(const row of [3,10,15]){
      const a=A.plotAt(-A.LIMIT+(row+.5)*A.ROW,0),baseLon=-Math.PI+3*tau/a.columns;
      for(const parallel of [false,true]){
        const lat=parallel?a.latitude+A.ROW/2:a.latitude,lon=parallel?baseLon+.26*tau/a.columns:baseLon,c=Math.cos(lat),s=Math.sin(lat),observer=dir(lat,lon);
        const even=Math.round((lat+A.LIMIT)/A.ROW),gap=(step,origin)=>{const n=(lon-origin)/step;return (n-Math.round(n))*step*c*R;};
        const rowGap=r=>gap(tau/A.columns(Math.max(0,Math.min(r,A.ROWS-1))),-Math.PI);
        gl.uniform4f(u('uAtlasLocalGrid'),(lat+A.LIMIT-even*A.ROW)*R,rowGap(even-1),rowGap(even),8000);
        gl.uniform4f(u('uAtlasLocalEast'),-Math.sin(lon),0,Math.cos(lon),gap(tau/A.TRUNK_MERIDIANS,0));
        gl.uniform4f(u('uAtlasLocalNorth'),-s*Math.cos(lon),c,-s*Math.sin(lon),(lat-(lat<0?-3:3)*A.ROW)*R);
        gl.uniform2f(u('uAtlasObserverLatitude'),s,c);
        for(const distance of [1600,7950,8050,16000,64000,220000])for(const offset of [0,10,-10]){
          const target=dir(lat+(parallel?offset:distance)/R,lon+(parallel?distance:offset)/(c*R));
          const delta=target.map((n,i)=>(n-observer[i])*R);
          gl.uniform3fv(u('aim'),target);gl.uniform3fv(u('offsetKm'),delta);
          gl.uniform1f(u('slant'),Math.hypot(...delta.map((n,i)=>n+543*observer[i])));
          gl.drawArrays(gl.TRIANGLES,0,3);const px=new Uint8Array(4);gl.readPixels(1,1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
          if(offset===0?px[0]<246:px[0]>4)failures.push({row,parallel,distance,offset,cover:px[0]});total++;
        }
      }
    }
    return {total,failures,count:failures.length};
  });
  console.log(JSON.stringify({...result,failures:result.failures.slice(0,12)}));assert.equal(result.count,0);
 }finally{await browser.close();await host.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
