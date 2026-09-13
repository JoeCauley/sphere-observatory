/* A chunk at a time, with transferable geometry and backpressure from GPU admission. */
'use strict';
importScripts('math.js','collection.js','biomes.js','world-palette.js','world.js','field-sites.js','edge-stream.js');
let queue=[],generation=0,waiting=false;
onmessage=({data})=>{
 if(data.type==='plan'){
  generation=data.generation;const fine=SphereEdges.plan(data.state,data.width,{fine:true}),coarse=SphereEdges.plan(data.state,data.width,{coarse:true});
  queue=data.keys.map(key=>[key,coarse.get(key)||fine.get(key)]).filter(x=>x[1]);waiting=false;
 }else if(data.generation===generation)waiting=false;
 if(!waiting)setTimeout(next,0);
};
function next(){
 if(waiting||!queue.length)return;waiting=true;const [key,build]=queue.shift(),start=performance.now();
 try{
  const mesh=build();mesh.bvh=SphereSites.packBVH(mesh.triangles);delete mesh.triangles;mesh.streamKey=key;
  postMessage({generation,key,mesh,buildMs:performance.now()-start},[mesh.vertices.buffer,mesh.bvh.packedTriangles.buffer,mesh.bvh.nodes.buffer]);
 }catch(error){postMessage({generation,error:String(error)});}
}
