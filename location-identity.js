/* Geographic identity is independent of camera activity and movement mode. */
(function(root){
'use strict';const M=root.SphereMath;
function resolve(s,previous=null){
 const q=M.norm(s.position),region=root.SphereWorld.sample(q,s),height=Math.abs(s.radius-M.length(s.position));
 const plate=s.shadeAttachment!==null?root.SphereInspection?.plate(s):null;
 if(plate&&root.SphereTravel.shadeClearance(s,plate).distance<1000)return {id:'shade-'+s.shadeAttachment,title:'Shade '+s.shadeAttachment,region:'Moving Shade',frame:'shade',parent:s.shadeAttachment};
 if(/^port-/.test(s.siteId)&&s.siteAnchor&&M.length(M.sub(s.position,M.mul(s.siteAnchor,s.radius)))<3)return {id:s.siteId,title:'Polar entry '+(s.siteId==='port-0'?'A':'B'),region:'Polar entry complex',frame:'shell'};
 if(s.siteId==='exterior-0'&&s.siteAnchor&&M.length(M.sub(s.position,M.mul(s.siteAnchor,s.radius+2500)))<100)return {id:'wound-spill',title:'Breach spill',region:'Wound '+(root.SphereWorld.nearestRim(s.siteAnchor,s).index+1),frame:'shell'};
 if(height<50000&&root.SpherePacks?.enabled(s)){
  const sample=root.SphereNeighbourhood?.sample(q,s),weights=sample?.compositionWeights;
  if(weights){const districts=root.SphereNeighbourhood.model(s.provinceSeed).compositions;let i=weights.indexOf(Math.max(...weights));const prior=districts.findIndex(c=>'watershed-'+c.id===previous?.id);if(prior>=0&&weights[prior]>.2&&weights[prior]+.12>=weights[i])i=prior;
   if(weights[i]>.25)return {id:'watershed-'+districts[i].id,title:{lake:'Receiving lake',reach:'Quiet reach',meadow:'Open meadow'}[districts[i].id],region:'Watershed',frame:'shell'};
  }
  const local=root.SphereWatershed.local(q,s);if(Math.max(...local.map(Math.abs))<640)return {id:'watershed',title:'The river gardens',region:'Watershed',frame:'shell'};
  if(sample)return {id:'watershed-region',title:'Connected catchments',region:'Watershed',frame:'shell'};
 }
 if(height<1000000)return {id:'region-'+region.id,title:region.name,region:region.id<10?'Habitat waist':'Shell works',frame:'shell'};
 return {id:'survey',title:M.length(s.position)<s.starRadius*25&&M.dot(s.forward,q)<-.9?'Central star':'Across the collection',region:'Free flight',frame:'shell'};
}
root.SphereLocation={resolve};
})(typeof window==='undefined'?globalThis:window);
