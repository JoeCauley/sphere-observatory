/* Both versioned pack adapters enter the same continuous world. */
(function(root){
'use strict';
const entries=Object.freeze([Object.freeze({id:'pack-infinite-meadow',packId:'infinite-meadow',version:'1.2.0',runtime:'shared-world',name:'Infinite Meadow',category:'packs',walk:true,entry:'packs/shared-world/1.1.0/index.html?pack=infinite-meadow',description:'Rolling hills and dense grass in the wind. Walk east to Infinite Industry in the same world.'}),Object.freeze({id:'pack-infinite-industry',packId:'infinite-industry',version:'1.2.0',runtime:'shared-world',name:'Infinite Industry',category:'packs',walk:true,entry:'packs/shared-world/1.1.0/index.html?pack=infinite-industry',description:'The working water works: intake, treatment, storage and distribution. Walk out into Infinite Meadow without leaving the world.'})]);
const base=root.document?.currentScript?.src?new URL('.',root.document.currentScript.src):null;
function get(id){return entries.find(p=>p.id===id)||null;}
function url(id,origin=base){const pack=get(id);if(!pack||!origin)throw Error('This Biome Pack is unavailable');return new URL(pack.entry,origin).href;}
function open(id,arrival='saved'){
 if(!get(id)||root.SphereApp?.busy||root.SphereJourney?.travel.status?.state==='preparing')throw Error('Finish the current travel or capture before visiting this Biome Pack.');
 if(!arrivals(id).some(a=>a.id===arrival))throw Error('Unsupported Biome Pack arrival');
 if(!root.SphereSession?.flush())throw Error('Could not keep the current Observatory viewpoint. Export a scene before leaving.');
 const destination=new URL(url(id));destination.searchParams.set('arrival',arrival);root.location.assign(destination.href);
}
function releaseReceipt(){for(const key of ['sphere-shared-world-last-release-v1','sphere-pack-last-release-v1'])try{const r=JSON.parse(root.localStorage.getItem(key));if(r?.schema===1&&entries.some(p=>p.packId===r.identity?.id&&[p.version,'1.1.0','1.0.0'].includes(r.identity?.version))&&r.status==='disposed')return r;}catch{}return null;}
function arrivals(id){return !get(id)?[]:[{id:'saved',label:'Continue the shared world · saved place',frame:'pack',units:'m'},{id:'ground',label:id==='pack-infinite-industry'?'Arrival court · on foot':'Meadow approach · on foot',frame:'pack',units:'m'},{id:'flight',label:id==='pack-infinite-industry'?'Above the water works · flight':'Above the meadow · flight',frame:'pack',units:'m'}];}
const api={entries,get,url,open,releaseReceipt,catalogue:()=>entries.map(p=>({...p})),arrivals};root.SpherePackLibrary=api;if(typeof module!=='undefined')module.exports=api;
const shortcut=root.document?.getElementById?.('openMeadowPack');if(shortcut){shortcut.href=url('pack-infinite-meadow');shortcut.textContent='Walk Meadow ↔ Industry';shortcut.onclick=e=>{e.preventDefault();try{open('pack-infinite-meadow','ground');}catch(error){root.SphereApp?.toast?.(error.message);}};}
})(typeof window==='undefined'?globalThis:window);
