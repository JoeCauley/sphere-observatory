/* P3 narrower cache experiment. Preserve exact current target and only the
 * paired half-metre horizontal window at the same row. No forward prefetch,
 * extra workers, relaxed credits, snapped current positions or ready flags. */
(function(root){'use strict';
const Supply=root.SphereMeadowSupplyP3.Supply,C=root.SphereMeadowSubmissionP3.Controller;
const originalContextCheck=Supply.prototype.checkContext;Supply.prototype.checkContext=function(){if(this.splitEpoch!==this.L.stats.splitJobs)this.lastSupplyKey=null;return originalContextCheck.call(this);};
Supply.prototype.lookahead=function(state,options,p){
 this.checkContext();this.future=[];this.futureRequests=[];this.futureOutstanding=false;const current=this.key(state,p.cameraLocal,options?.internalWidth||1920);if(current===this.lastSupplyKey)return;this.lastSupplyKey=current;const [center,scale]=JSON.parse(current),keep=new Set(this.L.requests.keys());
 for(const [key,entry]of this.cache){const [other,otherScale]=JSON.parse(key);if(otherScale===scale&&other[1]===center[1]&&Math.abs(other[0]-center[0])<=.5)for(const id of entry.requests.keys())keep.add(id);}this.kept=keep;
 const pinned=new Set([...(this.L.committed?.handles||[]),...(this.L.pending?.handles||[]),...(this.S.gpuBackend.pendingSelection?.handles||[])].map(h=>h.reservationToken));for(const r of [...this.S.allocations.values()])if(r.context===this.context&&!keep.has(r.block.id)&&!pinned.has(r.token)&&r.status!=='retired'&&!['queued','preparing','cancelled'].includes(r.status)){this.originalRetire.call(this.S,this.S.handle(r));this.stats.expiredPackets++;}
 this.metadataBytes=[...this.cache.values()].reduce((n,e)=>n+e.serializedBytes*8,0);this.S.retainCpuOwner(this.owner,this.metadataBytes);
};
Supply.prototype.prefetch=function(){};Supply.prototype.futureMissing=function(){this.futureStatus={desired:0,ready:0,admittedUnfinished:0,notAdmitted:0};return false;};
const previousSelect=C.prototype.select,previousInfo=Object.getOwnPropertyDescriptor(C.prototype,'info');C.prototype.select=function(enabled,options={}){previousSelect.call(this,enabled,{...options,variant:options.variant==='bounded'?'cached':options.variant});this.variant=options.variant||'typed';if(this.supply){this.supply.cacheLimit=2;this.supply.lookaheadMetres=0;}};Object.defineProperty(C.prototype,'info',{configurable:true,get(){const info=previousInfo.get.call(this);if(info.supply){info.supply.revision=3;info.supply.policy='Only exact current demand plus paired horizontal half-metre window at the same row; no forward prefetch';}return info;}});
})(window);
