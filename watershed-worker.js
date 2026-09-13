/* One bounded province, with its collision index, prepared before arrival. */
'use strict';
importScripts('math.js','collection.js','biomes.js','world-palette.js','world.js','field-sites.js','watershed-network.js','watershed-province.js');
onmessage=({data:s})=>{try{const groups=SphereWatershed.geometry(s),buffers=[];for(const mesh of groups){mesh.bvh=SphereSites.packBVH(mesh.triangles);delete mesh.triangles;buffers.push(mesh.vertices.buffer,mesh.bvh.packedTriangles.buffer,mesh.bvh.nodes.buffer);}postMessage({groups},buffers);}catch(e){postMessage({error:String(e)});}};
