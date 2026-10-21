/* Experimental storage sharing: detail packets retain their exact detail
 * records. Their identical clumps are supplied once from canonical fallback
 * packets. No plant, prototype, support, seed, rank or shader is changed. */
(function(root){'use strict';
function strip(packet){if(!packet.detailedCount||!packet.coarseCount)return packet;const indices=packet.groups.map((g,i)=>g.tier==='detail'?i:-1).filter(i=>i>=0),groups=indices.map(i=>packet.groups[i]);let length=0;for(const g of groups){if(g.byteOffset!==length)throw Error('P4 sharing requires a contiguous canonical detailed prefix');length+=g.byteLength;}
 const result={...packet,groups,regions:packet.regions.map(r=>({...r,counts:indices.map(i=>r.counts[i])})),records:packet.records.slice(0,length),recordCount:packet.detailedCount,coarseCount:0,byteLength:length};result.contentHash=root.SphereVegetationService.packetHash(result);return result;
}
root.SphereMeadowSharedPacketP4={strip};
})(typeof window==='undefined'?globalThis:window);
