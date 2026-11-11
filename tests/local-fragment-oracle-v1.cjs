'use strict';
const assert=require('node:assert/strict'),Model=require('../biome-service/native/local-stream-model.v2.js'),I=require('../biome-service/intervals.js');
const F=I.fromNumber,ref=[1,0,0,0,0,1,0,0,0,0,1,1,0,0,0,0],packet=new Float32Array(33),table=new Float64Array(Model.ORACLE_WORDS),out=[0,0,0,0];let pixels=0,maxErrorM=0;
for(const {points,plane}of [
 {points:[-4,-4,2,4,-4,2,-4,4,2],plane:[0,0,2]},
 {points:[-4,-4,2,4,-4,4,-4,4,8],plane:[.25,.75,6]},
 {points:[-4,-4,2,4,-4,4,-4,4,8],plane:[.25,.75,6]}
]){
 const positions=new Float32Array(points);Model.encodeTriangle(positions,[0,1,2],ref,packet,0,0);assert.equal(Model.oracleTriangle(positions,[0,1,2],packet,0,table,0).degenerate,false);
 for(const [width,height]of [[7,9],[1230,1494],[1306,1586]])for(const [x,y]of [[0,0],[Math.floor(width/2),Math.floor(height/2)],[width-1,height-1],[width-1,0],[0,height-1]]){
  const nx=I.sub(I.div(F(2*x+1),F(width)),F(1)),ny=I.sub(I.div(F(2*y+1),F(height)),F(1)),den=I.sub(F(1),I.add(I.mul(F(plane[0]),nx),I.mul(F(plane[1]),ny))),distance=I.div(F(plane[2]),den),expected=[I.mul(nx,distance),I.mul(ny,distance),distance];
  const denNumbers=I.toNumbers(den);if(denNumbers[0]/plane[2]<=.5/table[20])continue;Model.oraclePixel(table,0,x,y,width,height,out);
  for(let k=0;k<3;k++){const [lo,hi]=I.toNumbers(expected[k]);assert(out[k]-out[3]<=lo&&out[k]+out[3]>=hi,'Directed oracle must enclose the independent analytic plane/ray solution');}assert(out[3]<1e-6);maxErrorM=Math.max(maxErrorM,out[3]);pixels++;
 }
}
assert(pixels>=30);
assert.throws(()=>Model.oraclePixel(table,1,0,0,1,1,out),e=>e.code==='INVALID_PIXEL');
assert.throws(()=>Model.oraclePixel(table,0,1,0,1,1,out),e=>e.code==='INVALID_PIXEL');
const collinear=new Float32Array([0,0,2,1,1,2,2,2,2]);Model.encodeTriangle(collinear,[0,1,2],ref,packet,0);assert.equal(Model.oracleTriangle(collinear,[0,1,2],packet,0,table,0).degenerate,true);assert.throws(()=>Model.oraclePixel(table,0,0,0,1,1,out),e=>e.code==='UNPROVEN_PIXEL_ORACLE');
assert.throws(()=>Model.oracleTriangle(collinear,[0,1,2],packet,0,new Float64Array(1),0),e=>e.code==='INVALID_INPUT');
console.log(JSON.stringify({status:'PASS_COMPONENT_ONLY',analyticPixelChecks:pixels,maximumReferenceErrorM:maxErrorM,negativeControls:4,scope:'Independent I192 analytic plane/ray reference; no native GL claim'}));
