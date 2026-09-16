/* Catalogue entries are the seam for future versioned Biome Packs. */
(function(root){
'use strict';const M=root.SphereMath,W=root.SphereWorld,S=root.SphereSites;
const atmosphereKm=384400*2/3;
const categories=[
 {id:'overview',name:'Overview',family:'The collection'},
 {id:'biomes',name:'Biomes',family:'Living places'},
 {id:'watersheds',name:'Watersheds',family:'Builder places'},
 {id:'machinery',name:'Shell works',family:'Builder places'},
 {id:'poles',name:'Polar entries',family:'Builder places'},
 {id:'shades',name:'Shades',family:'Builder places'},
 {id:'wounds',name:'Wounds & beyond',family:'Builder places'}
];
function catalogue(s){return [
 ...[['overview','Across the collection'],['shades','Shade fleet'],['wounds','The long wounds'],['station','Central star']].map(([key,name])=>({id:'overview-'+key,name,category:'overview',description:'A broad view of '+name.toLowerCase()+'.',walk:false})),
 ...root.SphereBiomes.catalog.map((b,id)=>({id:'biome-'+id,name:b.name,category:'biomes',description:b.description,biome:id,walk:true})),
 ...root.SpherePacks.catalogue(s),
 ...['Thermal routing','Air & water exchange','Fabrication fields'].map((name,i)=>({id:'works-'+i,name,category:'machinery',description:['Quiet ceramic heat fields, woven channels and long service aisles.','Condensation works and branching air and water networks.','An immense fabric of assembly districts and service structures.'][i],biome:5,walk:true})),
 ...['A','B'].map((name,i)=>({id:'port-'+i,name:'Polar entry '+name,category:'poles',description:'A monumental gateway at the end of the shell axis, surrounded by service courts.',biome:5,walk:true})),
 ...root.SphereCollection.plates({...s,routeShades:true}).map(p=>({id:'shade-'+p.id,name:'Shade '+p.id+' · '+(p.damage?'broken edge':s.shadeGeometryRevision>=3?'intact edge':'service skin'),category:'shades',description:p.damage?'A fractured sunshade. Long through-openings expose its layered body and service structure. Close flight follows its motion.':'A moving sunshade with a continuous body and a finished perimeter. Close flight follows its motion.',biome:5,walk:false})),
 ...root.SphereCollection.wounds.map((w,i)=>({id:'wound-'+i,name:'Wound '+(i+1)+' · Breach spill',category:'wounds',description:'Pass through the opening into a field of torn shell remnants. The nearby spill is anchored to this Wound.',biome:4,walk:false}))
 ];}
function cloudAltitude(biome){const p=root.SphereWeatherProfiles[biome];return Math.max(.012,p.low-Math.min(.12,p.low*.28));}
function conditions(s,scene='day',weather='mixed'){
 s.placeScene=scene;s.placeWeather=weather;s.clouds=weather!=='clear';s.weatherStrength={clear:0,mixed:.55,cover:.88,precipitation:.92,storm:1}[weather];s.atmosphere=Math.max(.6,s.atmosphere);return s;
}
const watershedViews=[['neighbourhood','Connected catchments · 40,000 km','shell'],['region','Receiving reaches · 10,000 km','shell'],['province','The whole watershed · 1,100 km','shell'],['approach','River country · 48 km','shell'],['garden','Water garden · 1 km','landscape'],['terrace','Terrace inspection · 6 m','terrace floor']];
function arrivals(s,id){const entry=catalogue(s).find(p=>p.id===id);if(!entry)return [];
 if(id.startsWith('overview-'))return [{id:'regional',label:'Regional view',frame:'shell',units:'km'}];
 if(id.startsWith('wound-'))return [{id:'ground',label:'Exterior spill · free flight',frame:'shell',units:'km'}];
 const list=[{id:'ground',label:entry.walk?'On foot'+(id.startsWith('port-')?' · bounded court':''):'Close flight · 35 m above Shade skin',frame:id.startsWith('shade-')?'shade':'shell',units:'km'}];
 if(id==='watershed')return [...watershedViews.map(([id,label,reference])=>({id,label,reference,frame:'shell',units:'km'})),...list];
 if(entry.composition)list.push({id:'regional',label:'Regional view · 9,000 km',frame:'shell',units:'km'});
 return [...list,{id:'clouds',label:id.startsWith('shade-')?'Close flight · 700 m above Shade skin':'Below clouds · '+Math.round(cloudAltitude(entry.biome)*1000)+' m',frame:id.startsWith('shade-')?'shade':'shell',units:'km'},{id:'atmosphere',label:'High-altitude view · 256,267 km',frame:id.startsWith('shade-')?'shade':'shell',units:'km'}];
}
function availability(s,id,arrival){
 if(!s.collection||s.layoutVersion!==2)return {available:false,reason:'These Places use Collection layout 2. Choose that world model and geography in World.'};
 if((id==='biome-4'||id.startsWith('wound-')||id==='overview-wounds')&&s.era==='before')return {available:false,reason:'Available after the attack. Choose After attack in World.'};
 if((id.startsWith('wound-')||id==='overview-wounds')&&!s.multipleWounds)return {available:false,reason:'Enable six Wounds in World to visit this opening.'};
 if(!catalogue(s).some(p=>p.id===id))return {available:false,reason:'This destination is unavailable in the current world.'};
 if(arrival&&!arrivals(s,id).some(a=>a.id===arrival))return {available:false,reason:'This arrival is not supported at this destination.'};
 return {available:true,reason:''};
}
function worksAnchor(id,s){for(let i=0;i<2400;i++){const q=W.direction(.28+i%30*.035,i*2.399963229728653,s);if(!M.inBreach(q,s)&&W.sample(q,s).id===10+id)return q;}throw Error('No service district found in this shell layout.');}
async function destination(input,id,altitude='ground',scene,weather,options={}){
 const allowed=availability(input,id,altitude);if(!allowed.available)throw Error(allowed.reason);
 const finish=s=>scene===undefined&&weather===undefined?s:conditions(s,scene??input.placeScene,weather??input.placeWeather);
 const entry=catalogue(input).find(p=>p.id===id);if(!entry)throw Error('This Place is unavailable in the current era.');
 let s={...structuredClone(input),layoutVersion:2,collection:true,biome:-1,siteId:'',siteAnchor:null,siteRevision:0,siteElevation:0,walkSurface:false,walkMode:false,walkPosition:null,walkVelocity:0,shadeAttachment:null,geometryDetail:true,projection:'perspective',surfaceLock:true};
 if(id==='biome-4'&&s.era==='before')throw Error('The Ruin belongs to the world after the attack. Choose After attack in World.');
 let q,ground=0;
 if(id.startsWith('overview-')){
  const name=id.slice(9);
  if(name==='overview'){s.position=M.mul(M.axis(28,-60),s.radius*.08);s.forward=M.norm([.25,-.15,1]);}
  if(name==='wounds'){q=root.SphereCollection.wounds[0].axis;s.position=M.mul(q,s.radius*.55);s.forward=q;}
  if(name==='shades'){const p=root.SphereCollection.plates({...s,routeShades:true})[0];s.routeShades=true;s.position=M.mul(M.norm(M.add(p.normal,M.mul(p.up,.30))),s.radius*.9);s.forward=M.norm(M.sub(M.mul(p.normal,s.radius*.62),s.position));}
  if(name==='station'){q=M.norm([.7,.8,1]);s.position=M.mul(q,s.starRadius*20);s.forward=M.mul(q,-1);}
  s.up=M.basis(s.forward).u;return finish(s);
 }
 if(id==='watershed'){
  s=root.SpherePacks.activate(s);await root.SphereWatershed.prepare(s,options);const terrace=root.SphereWatershed.view(s,'terrace');
  if(watershedViews.some(v=>v[0]===altitude))return finish(root.SphereWatershed.view(s,altitude));
  q=M.norm(terrace.position);ground=s.radius-M.length(terrace.position)-.026;
  if(altitude==='ground'){s={...terrace,autoSpeed:input.autoSpeed,speed:input.speed};root.SphereLanding.enter(s,s.position,{activate:false});return finish(s);}
 }else if(entry.composition){
  s=root.SpherePacks.activate(s);s.packAddress.artRevision=2;
  if(altitude==='regional')return finish(root.SphereNeighbourhood.view(s,entry.composition));
  const district=root.SphereNeighbourhood.model(s.provinceSeed).compositions.find(c=>c.id===entry.composition);
  q=root.SphereWatershed.direction(...district.bank,s);
  if(root.SphereNeighbourhood.sample(q,s).water||root.SphereCollection.missing(q,s))throw Error('This composition has no dry arrival in the current world.');
 }else if(id.startsWith('wound-')){
  const axis=root.SphereCollection.wounds[Number(id.slice(6))].axis;
  Object.assign(s,root.SphereArrival.spill(s,axis));s.speed=input.speed;return finish(s);
 }else if(id.startsWith('shade-')){
  s.routeShades=true;s.siteId=id;s.shadeAttachment=Number(id.slice(6));const plate=root.SphereCollection.plates(s).find(p=>p.id===s.shadeAttachment);s.siteAnchor=plate.normal;
  const mesh=S.shadeSection(s),height=altitude==='atmosphere'?atmosphereKm:altitude==='clouds'?.7:.035;
  s.position=mesh.world([-.3,height,.75]);s.forward=M.norm(M.sub(mesh.world([.5,0,0]),s.position));s.up=mesh.basis[1];return finish(s);
 }else if(id.startsWith('port-'))q=M.mul(W.frame(s).axis,id==='port-0'?1:-1);
 else if(id.startsWith('works-'))q=worksAnchor(Number(id.slice(6)),s);
 else {q=W.locateBiome(entry.biome,s);if(root.SphereWatershed?.sample(q,s))q=root.SphereWatershed.direction(s.packAddress?80000:500,0,s);}
 ground=Math.max(ground,root.SphereWatershed?.sample(q,s)?.terrainKm||0);
 const height=altitude==='atmosphere'?Math.min(atmosphereKm,s.radius-s.starRadius*1.03):altitude==='clouds'?cloudAltitude(entry.biome)+ground:ground+.08;
 s.position=M.mul(q,s.radius-height);const frame=S.shellFrame(q);
 s.forward=altitude==='atmosphere'?q:M.norm(M.add(frame[2],M.mul(frame[1],-.08)));s.up=M.basis(s.forward,frame[1]).u;
 if(altitude==='ground'){if(id.startsWith('port-')){s.siteId=id;s.siteAnchor=q;s.siteRevision=1;}root.SphereLanding.enter(s,s.position,{activate:false});}
 return finish(s);
}
// An explicitly chosen artistic illumination study, carried with the scene.
// It does not alter eclipse geometry, simulation time or the user's star power.
function renderState(s){
 const factor={'first-light':.34,darkness:.14,day:1,dark:.006}[s.placeScene]??1;
 return factor===1?s:{...s,luminosity:s.luminosity*factor};
}
root.SpherePlaces={categories,catalogue,destination,conditions,arrivals,availability,watershedViews,cloudAltitude,atmosphereKm,renderState};
})(typeof window==='undefined'?globalThis:window);
