/* P2: a sparse, genuinely three-dimensional canopy made from original F2
 * stems. Packed roots, stem numbers, phase law, material/depth shaders and
 * strict overlap ranks are unchanged. This is explicitly new experimental
 * appearance, with no inherited F2 acceptance. */
(function(root){
'use strict';
const API=root.SphereMeadowPrototype,E=root.SphereInstancedEnvironment,GPU=root.SphereVegetationGPU;
if(!API)throw Error('P2 requires the retained P1 comparison overlay');
const originalInstall=API.install,originalSelect=API.select;
API.install=async function(renderer){
 const p1=await originalInstall(renderer),state=SphereApp.getState(),source=SphereMeadowCanopy.prototypes(state)[0],lod=source.lods[0],prototypes={},geometry={};
 if(lod.vertices.length!==72*16*6||lod.indices.length!==72*36)throw Error('Unexpected frozen F2 clump geometry');
 for(const [name,count,width]of [['volume12',12,1.75],['volume18',18,1.60],['volume24',24,1.35]]){
  const vertices=new Float32Array(lod.vertices),indices=[],stems=[];
  for(let i=0;i<count;i++){
   const stem=Math.floor((i+.5)*72/count);stems.push(stem);
   // Keep original vertex addresses so the native F2 height, flutter, palette,
   // and GPU rank-mask laws continue to use the original stem number.
   for(let plane=0;plane<2;plane++)for(let row=0;row<4;row++){
    const a=(stem*16+plane*8+row*2)*6,b=a+6;
    for(let k=0;k<3;k++){const mid=(lod.vertices[a+k]+lod.vertices[b+k])*.5;vertices[a+k]=mid+(lod.vertices[a+k]-mid)*width;vertices[b+k]=mid+(lod.vertices[b+k]-mid)*width;}
   }
   indices.push(...lod.indices.subarray(stem*36,(stem+1)*36));
  }
  prototypes[name]=E.createPrototype({id:'meadow-canopy-p2-'+name,vertices,indices,wind:true,roughness:source.material.roughness});
  geometry[name]={retainedStemNumbers:stems,stems:count,widthFactor:width,storedVertices:vertices.length/6,referencedVertices:count*16,triangles:indices.length/3,cpuBytes:prototypes[name].lods[0].bytes};
  renderer.gl.bindVertexArray(null);renderer.environment.residentPrototype(prototypes[name],0);
 }
 const previous=GPU.PersistentRecords.prototype.representationPrototype;
 GPU.PersistentRecords.prototype.representationPrototype=function(prototype,variant){return prototypes[API.mode]&&prototype.id==='meadow-volume-clump-f2'?prototypes[API.mode]:previous.call(this,prototype,variant);};
 API.profile='meadow-prototype-p2';API.revision=2;API.volumeGeometry=geometry;
 API.select=function(mode){if(!['baseline','p1','volume12','volume18','volume24'].includes(mode))throw Error('Unknown P2 mode');API.mode=mode;};
 return {...p1,profile:API.profile,revision:API.revision,volumeGeometry:geometry,scope:'Retained P1 and two sparse volume experiments. All allocated geometry and atlas remain physically charged.'};
};
})(window);
