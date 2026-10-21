/* P3 diagnostic observer only. Remove before quiet measurements. */
(function(root){'use strict';
class Trace{
 constructor(renderer){this.renderer=renderer;this.population=renderer.meadow.productionPopulation;this.saved=[];this.depth=[];this.rows={};const p=this.population,L=p.lifecycle,S=p.service,B=S.gpuBackend;
  for(const [object,names,prefix]of [[renderer.meadow,['requestProduction'],'demand'],[L,['updateDemand','admit','recoverFragmentation','candidate','prepare'],'lifecycle'],[L.pool,['drain','accept','pump'],'worker'],[S,['receive','stageGpu','commit','collectRetired','reserve'],'service'],[B,['plan','selectProgressive','uploadRange','prepareSelection'],'backend']])for(const name of names)this.wrap(object,name,prefix+'.'+name);
 }
 wrap(object,name,key){const old=object[name];if(typeof old!=='function')return;const trace=this;this.saved.push({object,name,old});object[name]=function(...args){const start=performance.now(),entry={key,start,child:0};trace.depth.push(entry);try{return old.apply(this,args);}finally{const ms=performance.now()-start;trace.depth.pop();if(trace.depth.length)trace.depth.at(-1).child+=ms;const row=trace.rows[key]||(trace.rows[key]={calls:0,inclusiveMs:0,selfMs:0});row.calls++;row.inclusiveMs+=ms;row.selfMs+=ms-entry.child;}};}
 reset(){this.rows={};}
 snapshot(){const p=this.population,L=p.lifecycle,S=p.service,B=S.gpuBackend,pending=B.pendingSelection;const byId=new Map();for(const r of S.allocations.values())if(r.context===S.current.get(L.providerId)&&!['cancelled','retired'].includes(r.status))byId.set(r.block.id,r);
  let missing=0,unstaged=0,requestedDetail=0;for(const request of L.requests.values()){if(request.block.tier==='detail')requestedDetail++;const r=byId.get(request.block.id);if(!r)missing++;else if(!S.prepared(S.handle(r)))unstaged++;}
  return {methods:Object.fromEntries(Object.entries(this.rows).map(([key,value])=>[key,{...value}])),cameraLocal:[...p.cameraLocal],generatedDemandKey:L.generatedDemand?.key,managerDemandKey:this.renderer.meadow.productionDemandKey,version:L.version,committedVersion:L.committed?.version,pendingVersion:L.pending?.version,candidateVersion:L.candidateCache?.version,requestedJobs:L.requests.size,requestedDetailJobs:requestedDetail,missingJobs:missing,unstagedJobs:unstaged,denial:L.lastDenial||null,pending:pending?{count:pending.count,family:pending.family,range:pending.range,instance:pending.instance,built:pending.built,compared:pending.compared,blocked:pending.blocked||false}:null,worker:L.workerInfo,selection:B.selection?{...B.selection}:null,referenceQuantum:L.options.maxReferences,budgetMs:L.options.maxPreparationMs};
 }
 dispose(){for(const {object,name,old}of this.saved.reverse())object[name]=old;this.saved=[];}
}
root.SphereMeadowTraceP3={Trace};})(window);
