// Read the height submitted by the actual Meadow terrain vertex shader beside
// and beneath the Monumental approach, looking from Bay 0's outer roof corner.
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {session,executable}=require('./support/biome-browser.cjs');

async function main(){
  const server=await session(),browser=await chromium.launch({headless:true,executablePath:executable()});
  try{
    const context=await browser.newContext();await server.attach(context);
    const page=await context.newPage();await page.goto(server.origin+'/packs/biome-library.json');
    const results=await page.evaluate(async()=>{
      const meadow='/packs/infinite-meadow/1.3.0/',border='/packs/border-transport/0.10.0/';
      const [{meadowShaders,compile},{GROUND_DATUM},{districtFor},{generateStation}]=await Promise.all([
        import(meadow+'renderer.js'),import(meadow+'model.js'),import(border+'survey.mjs'),import(border+'station.mjs')
      ]);
      const gl=document.createElement('canvas').getContext('webgl2');
      const program=compile(gl,meadowShaders.terrainVS,meadowShaders.groundFS);
      gl.transformFeedbackVaryings(program,['position'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      const location=name=>gl.getUniformLocation(program,name);
      const district=districtFor('sphere-ed6a59ab491a9a08','r10c0','r10c1',149597870700);
      const station=generateStation(district.sites[1].address),face=-station.widthM/2;
      gl.uniform4f(location('uApron'),16014,face+2,16000,Math.abs(face)+3500);
      gl.uniform4f(location('uApronAxes'),1,0,0,1);
      gl.uniform4fv(location('uDoorCenters'),station.routes.map(r=>r.nearDoor[0]));
      gl.uniform4fv(location('uDoorWidths'),station.routes.map(r=>r.door[0]/2+5));
      gl.uniform1f(location('uApronDatum'),GROUND_DATUM);
      const buffer=gl.createBuffer();gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,buffer);
      gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,12,gl.STREAM_READ);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,buffer);gl.enable(gl.RASTERIZER_DISCARD);
      const samples=[];
      // These vertices lie in the 1,024 m grid ring, 15–17 km away.
      for(const [x,z,ground] of [[-16384,-2048,GROUND_DATUM],[-15360,-2048,GROUND_DATUM-.65],[-16384,-3072,GROUND_DATUM],[-16384,-4096,GROUND_DATUM],[-16384,-8192,12]]){
        gl.vertexAttrib3f(0,x,9,z);
        gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,1);gl.endTransformFeedback();
        const vertex=new Float32Array(3);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,vertex);
        const expected=ground+(x*x+z*z)*.00000000000334229;
        samples.push({x,z,height:vertex[1],expected});
      }
      if(gl.getError()!==gl.NO_ERROR)throw Error('Could not read terrain vertex heights');
      return samples;
    });
    console.log(JSON.stringify(results));
    for(const sample of results)assert(Math.abs(sample.height-sample.expected)<.003,
      'The coarse ground must support the road and return to the landscape height outside the graded apron');
  }finally{await browser.close();await server.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
