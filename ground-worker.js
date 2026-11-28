/* Ground reservation uses the edge manager's upload admission and backpressure. */
'use strict';
importScripts('world-address.js','world-topology.js','math.js','collection.js','biomes.js','world-palette.js','biome-packs.js','world.js','watershed-network.js','field-sites.js','legacy-role-adapter.js','edge-stream.js','shade-edges.js','watershed-province.js','world-geography.js','watershed-neighbourhood.js','meadow-ecology.js','packs/super-jungle/1.0.0/stand-geometry.js','packs/violet-labyrinth/1.0.0/forest.js','ground-chunks.js');
let jobs=[],generation=0,state=null,apronRules;
onmessage=async ({data})=>{
 try{
  if(!data.next){
   generation=data.generation;state=data.state;jobs=data.jobs;
   if(!jobs.length)return;
   if(data.apron){
    apronRules??=import('./packs/border-transport/0.10.0/district.mjs');
    const rules=await apronRules;
    if(data.generation!==generation)return;
    SphereGround.setApronSurvey(data.apron,rules);
   }else SphereGround.setApronSurvey(null);
  }else if(data.generation!==generation)return;
  if(!jobs.length)return;
  const job=jobs.shift(),start=performance.now();
  const mesh=SphereGround.build(state,job.x,job.z,job.cells,job.centre,job),wall=mesh.ground.rim?.wall;
  if(wall){wall.bvh=SphereSites.packBVH(wall.triangles);delete wall.triangles;}
  const buffers=[mesh.vertices.buffer,mesh.bvh.nodes.buffer,mesh.bvh.packedTriangles.buffer,mesh.ground.floor.nodes.buffer,mesh.ground.floor.packedTriangles.buffer];
  if(wall)buffers.push(wall.vertices.buffer,wall.bvh.nodes.buffer,wall.bvh.packedTriangles.buffer);
  postMessage({generation,key:job.key,cellId:job.cellId,basePriority:job.basePriority,mesh,buildMs:performance.now()-start},[...new Set(buffers)]);
 }catch(error){if(data.generation===generation)postMessage({generation,error:String(error)});}
};
