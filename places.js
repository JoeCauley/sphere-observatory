/* Catalogue entries are the seam for future versioned Biome Packs. */
(function(root){
'use strict';const M=root.SphereMath,W=root.SphereWorld,S=root.SphereSites;
const atmosphereKm=384400*2/3;
const categories=[
 {id:'biomes',name:'Biomes',family:'Living places'},
 {id:'watersheds',name:'Watersheds',family:'Builder places'},
 {id:'machinery',name:'Shell works',family:'Builder places'},
 {id:'poles',name:'Polar entries',family:'Builder places'},
 {id:'shades',name:'Shades',family:'Builder places'},
 {id:'wounds',name:'Wounds & beyond',family:'Builder places'}
];
function catalogue(s){return [
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
function worksAnchor(id,s){for(let i=0;i<2400;i++){const q=W.direction(.28+i%30*.035,i*2.399963229728653,s);if(!M.inBreach(q,s)&&W.sample(q,s).id===10+id)return q;}throw Error('No service district found in this shell layout.');}
async function destination(input,id,altitude='ground',scene='day',weather='mixed'){
 const entry=catalogue(input).find(p=>p.id===id);if(!entry)throw Error('This Place is unavailable in the current era.');
 let s={...structuredClone(input),layoutVersion:2,collection:true,biome:-1,siteId:'',siteAnchor:null,siteRevision:0,siteElevation:0,walkSurface:false,walkMode:false,walkPosition:null,walkVelocity:0,shadeAttachment:null,geometryDetail:true,projection:'perspective',surfaceLock:true};
 if(id==='biome-4'&&s.era==='before')throw Error('The Ruin belongs to the world after the attack. Choose After attack in World.');
 let q,ground=0;
 if(id==='watershed'){
  s=root.SpherePacks.activate(s);await root.SphereWatershed.prepare(s);const terrace=root.SphereWatershed.view(s,'terrace');
  q=M.norm(terrace.position);ground=s.radius-M.length(terrace.position)-.026;
  if(altitude==='ground'){s={...terrace,autoSpeed:input.autoSpeed,speed:input.speed};root.SphereLanding.enter(s,s.position);return conditions(s,scene,weather);}
 }else if(entry.composition){
  s=root.SpherePacks.activate(s);s.packAddress.artRevision=2;
  if(altitude==='regional')return conditions(root.SphereNeighbourhood.view(s,entry.composition),scene,weather);
  const district=root.SphereNeighbourhood.model(s.provinceSeed).compositions.find(c=>c.id===entry.composition);
  q=root.SphereWatershed.direction(...district.bank,s);
  if(root.SphereNeighbourhood.sample(q,s).water||root.SphereCollection.missing(q,s))throw Error('This composition has no dry arrival in the current world.');
 }else if(id.startsWith('wound-')){
  s.era='after';s.multipleWounds=true;const axis=root.SphereCollection.wounds[Number(id.slice(6))].axis;
  Object.assign(s,root.SphereArrival.spill(s,axis));s.speed=input.speed;return conditions(s,scene,weather);
 }else if(id.startsWith('shade-')){
  s.routeShades=true;s.siteId=id;s.shadeAttachment=Number(id.slice(6));const plate=root.SphereCollection.plates(s).find(p=>p.id===s.shadeAttachment);s.siteAnchor=plate.normal;
  const mesh=S.shadeSection(s),height=altitude==='atmosphere'?atmosphereKm:altitude==='clouds'?.7:.035;
  s.position=mesh.world([-.3,height,.75]);s.forward=M.norm(M.sub(mesh.world([.5,0,0]),s.position));s.up=mesh.basis[1];return conditions(s,scene,weather);
 }else if(id.startsWith('port-'))q=M.mul(W.frame(s).axis,id==='port-0'?1:-1);
 else if(id.startsWith('works-'))q=worksAnchor(Number(id.slice(6)),s);
 else {q=W.locateBiome(entry.biome,s);if(root.SphereWatershed?.sample(q,s))q=root.SphereWatershed.direction(s.packAddress?80000:500,0,s);}
 ground=Math.max(ground,root.SphereWatershed?.sample(q,s)?.terrainKm||0);
 const height=altitude==='atmosphere'?Math.min(atmosphereKm,s.radius-s.starRadius*1.03):altitude==='clouds'?cloudAltitude(entry.biome)+ground:ground+.08;
 s.position=M.mul(q,s.radius-height);const frame=S.shellFrame(q);
 s.forward=altitude==='atmosphere'?q:M.norm(M.add(frame[2],M.mul(frame[1],-.08)));s.up=M.basis(s.forward,frame[1]).u;
 if(altitude==='ground'){if(id.startsWith('port-')){s.siteId=id;s.siteAnchor=q;s.siteRevision=1;}root.SphereLanding.enter(s,s.position);}
 return conditions(s,scene,weather);
}
// An explicitly chosen artistic illumination study, carried with the scene.
// It does not alter eclipse geometry, simulation time or the user's star power.
function renderState(s){
 const factor={'first-light':.34,darkness:.14,day:1,dark:.006}[s.placeScene]??1;
 return factor===1?s:{...s,luminosity:s.luminosity*factor};
}
root.SpherePlaces={categories,catalogue,destination,conditions,cloudAltitude,atmosphereKm,renderState};
})(typeof window==='undefined'?globalThis:window);
