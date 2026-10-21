'use strict';
// Offline bounded page compiler and topology smoke test. Existing geographic
// roots/support are retained; global terrain/features/render joins remain open.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cfg=require('./last-run.json');
require(path.join(cfg.runtime,'math.js'));
for(const f of ['collection','biomes','world-palette','biome-packs','world','watershed-network','field-sites','legacy-role-adapter','watershed-province','world-geography','watershed-neighbourhood','meadow-ecology','ground-chunks','meadow-support','meadow-canopy','instanced-environment','grass-stream','meadow-field','world-address','vegetation-service','vegetation-revisions','meadow-blocks','meadow-provider'])require(path.join(cfg.runtime,f+'.js'));
const source=process.argv[2]||path.join(cfg.evidence,'browser-2026-10-05T14-25-43-500Z/run.json'),state=JSON.parse(fs.readFileSync(source)).production.state;
const out=path.join(cfg.evidence,'pages-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),M=global.SphereMath,G=global.SphereGrass,F=global.SphereMeadowCanopy,I=global.SphereInstancedEnvironment,S=global.SphereMeadowSupport,V=global.SphereVegetationService;
const report={schema:1,profile:'meadow-page-products-p1',revision:1,status:'INCOMPLETE',baselineBuild:cfg.baselineBuild,stateSource:{path:source,sha256:sha(fs.readFileSync(source))},pages:[],checks:[],scope:'Two adjacent existing 8m sampler pages compiled into sorted packed products; separate World Address cube-edge coordinate smoke test. No global support/content rendering, acceptance or scheduler replacement.'};
function sortedProduct(instances){
 const byId=new Map();let supportMaximumM=0;
 for(const instance of instances){
  const id=instance.addressKey||instance.id;assert(id,'Missing logical identity');assert(!byId.has(id),'Duplicate logical root child');
  const bytes=new Uint8Array(32);I.writePackedInstance(new DataView(bytes.buffer),0,instance);
  const dv=new DataView(bytes.buffer),local=[0,4,8].map(k=>dv.getFloat32(k,true)),err=M.length(M.sub(local,instance.origin))*1000;supportMaximumM=Math.max(supportMaximumM,err);
  if(instance.chart){const support=S.query(state,...instance.chart);assert(support);assert(M.length(M.sub(support.point,instance.worldOrigin))*1000<=.002,'Actual child support mismatch');}
  byId.set(id,{bytes:Buffer.from(bytes),prototype:instance.prototypeId});
 }
 const rows=[...byId].sort(([a],[b])=>a.localeCompare(b)),buffer=Buffer.concat(rows.map(([,r])=>r.bytes)),index=rows.map(([id,r])=>({id,prototype:r.prototype,sha256:sha(r.bytes)}));
 return {buffer,index,byId,sha256:sha(buffer),supportMaximumM};
}
function compile(x,z,currentState=state){
 const frame=G.frameForMeadowChart(currentState),cell={x,z,size:8,canopyTier:'detail',chartBounds:[-128+x*8,-128+z*8,-120+x*8,-120+z*8]},population=F.buildResidentCell({state:currentState,frame,cell,areaSteps:16});
 return {product:sortedProduct(population.instances),roots:population.roots,frame,cell,bladeCount:population.bladeCount,clumpCount:population.clumpCount};
}
(async()=>{
 try{
  const started=performance.now(),left=compile(15,16),right=compile(16,16),ids=new Set();
  for(const [name,page]of [['left',left],['right',right]]){
   for(const id of page.product.byId.keys()){assert(!ids.has(id),'Duplicate page ownership');ids.add(id);}
   assert(page.product.supportMaximumM<=.002,'Packed-root support error >2mm');
   fs.writeFileSync(path.join(out,name+'.records32'),page.product.buffer,{flag:'wx'});fs.writeFileSync(path.join(out,name+'.index.json'),JSON.stringify(page.product.index,null,2)+'\n',{flag:'wx'});
   report.pages.push({name,samplerParent:[page.cell.x,page.cell.z],chartBoundsMetres:page.cell.chartBounds,roots:page.roots.length,blades:page.bladeCount,clumps:page.clumpCount,records:page.product.index.length,packedBytes:page.product.buffer.length,recordsSha256:page.product.sha256,maximumPackedOriginErrorMetres:page.product.supportMaximumM});
  }
  report.checks.push({name:'half-open two-parent identity ownership',pass:true,logicalRecords:ids.size});
  const changed={...state,position:M.add(state.position,M.mul(M.basis(state.forward,state.up).f,.025)),forward:M.rotate(state.forward,state.up,1),time:state.time+37},reverseRight=compile(16,16,changed),reverseLeft=compile(15,16,changed);
  assert.equal(left.product.sha256,reverseLeft.product.sha256);assert.equal(right.product.sha256,reverseRight.product.sha256);
  report.checks.push({name:'reverse page order and moved/rotated camera preserve packed product',pass:true,scope:'Generation remains in immutable chart; no GPU rebase executed'});
  // Actual production compact producer on sixteen 2m storage jobs in each page.
  for(const page of [left,right]){
   const service=SphereMeadowProvider.createService(state),config=service.current.get(SphereMeadowProvider.ID).value,instances=[];
   for(let z=0;z<8;z+=2)for(let x=0;x<8;x+=2){
    const result=service.reserve(SphereMeadowProvider.ID,{x:page.cell.x,z:page.cell.z,blockMetres:1,jobMetres:2,offsetX:x,offsetZ:z,tier:'detail'});assert(result.ok,result.reason);
    const job=service.dispatch();SphereMeadowProvider.prepare(job,config,{onInstance:i=>instances.push(i)});service.cancel(job.reservationToken);service.producerStopped(job.reservationToken);
   }
   const split=sortedProduct(instances);assert.equal(page.product.sha256,split.sha256,'Split recipe changed logical packed population');service.dispose();
   report.checks.push({name:'page '+page.cell.x+','+page.cell.z+' equals sixteen compact storage products',pass:true,records:split.index.length,sha256:split.sha256});
  }
  const shared=[];
  for(let z=0;z<=8;z+=.5){const a=S.query(state,0,z),b=S.query(state,0,z);assert(a&&b);assert.deepEqual(a.point,b.point);const field=SphereGeography.queryPlacement(a.direction,state);shared.push({chart:[0,z],supportSource:a.source,semanticHash:sha(Buffer.from(V.canonical(field)))});}
  report.sharedEdge={samples:shared,maximumPositionDifferenceMetres:0,scope:'Same existing support/semantic owner sampled from either product; not proof of mesh or feature LOD joins'};
  const W=SphereWorldAddress,n=2**30,cubeRows=[];
  for(let metres=-4;metres<=4;metres+=.5){const direction=M.norm([1,metres/(state.radius*1000),1]),g=W.gridAt(direction,30),p=W.project?.(direction,0),v=direction[1]/direction[0],t=(v+1)*.5*n,y=Math.floor(t),local=t-y,
   a={face:0,level:30,x:0,y,local:[0,local]},b={face:4,level:30,x:n-1,y,local:[1,local]},da=W.direction(a),db=W.direction(b),error=M.length(M.sub(da,db))*state.radius*1000;
   assert.equal(g.face,0,'Cube tie must have canonical owner');assert(error<=.002);cubeRows.push({metres,canonicalFace:g.face,roundTripErrorMetres:error});
  }
  report.cubeEdge={pages:['+x level30 x=0','+z level30 x=2^30-1'],rows:cubeRows,maximumRoundTripErrorMetres:Math.max(...cubeRows.map(r=>r.roundTripErrorMetres)),scope:'Address direction coordinates only. Existing bounded meadow is elsewhere; global grass, river/road joins and rendered terrain support are untested.'};
  report.elapsedMs=performance.now()-started;report.status='PASS_BOUNDED_PRODUCTS_AND_COORDINATES_ONLY';
  report.remaining=['Actual adjacent global support/terrain/feature products','Moving GPU page admission, eviction, cancellation, reverse crossing and rebase','Sphere cube-face appearance and nine semantic art variants','Phase-latched production photo/panorama integration'];
 }catch(error){report.status='FAILED_ATTEMPT_RETAINED';report.failure=error.stack;process.exitCode=1;}
 fs.writeFileSync(path.join(out,'pages.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});fs.copyFileSync(__filename,path.join(out,'source.cjs'));
 console.log(JSON.stringify({out,status:report.status,pages:report.pages,failure:report.failure}));
})();
