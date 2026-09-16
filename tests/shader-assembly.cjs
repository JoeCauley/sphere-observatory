const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),baseline=require('./fixtures/shader-baseline.json');
const modules=['math','collection','biomes','world-palette','biome-packs','world','field-sites','watershed-network','watershed-province','watershed-neighbourhood','shaders','shader-sections','collection-shader','biome-shader','world-shader','neighbourhood-shader','surface-lighting','silhouette-aa'];
const c={console,performance,Uint8Array,Uint32Array,Float32Array,Float64Array,Map,Set,Math};c.window=c;c.globalThis=c;vm.createContext(c);for(const f of modules)vm.runInContext(fs.readFileSync(f+'.js','utf8'),c,{filename:f+'.js'});
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');for(const name of ['vertex','fragment','geometryFragment'])assert.equal(hash(c.SphereShaders[name]),baseline[name],name+' remains byte identical to the reviewed baseline');assert.equal(hash(c.SphereLegacyShaders.fragment),baseline.legacy);assert(c.SphereShaderSections.inventory.length>=8);assert(c.SphereShaderSections.changes.length>=40);assert.throws(()=>c.SphereShaderSections.section('test')('missing','slot','value'),/expected 1/);assert.throws(()=>c.SphereShaderSections.section('test')('slot slot','slot','value'),/found 2/);console.log('PASS checked named shader sections and byte-identical modern/legacy/geometry assembly');

// Keep the historical fingerprints above. The performance transform changes
// only station intersection arithmetic and conservative source-cone admission.
const before={fragment:c.SphereShaders.fragment,geometryFragment:c.SphereShaders.geometryFragment,legacy:c.SphereLegacyShaders.fragment};
vm.runInContext(fs.readFileSync('station-shader-performance.js','utf8'),c,{filename:'station-shader-performance.js'});
for(const name of Object.keys(before)){
 const original=before[name],optimized=name==='legacy'?c.SphereLegacyShaders.fragment:c.SphereShaders[name];
 const start=original.indexOf('float stationHit('),end=original.indexOf('// One shared stellar sample set:',start),oldStation=original.slice(start,end);
 const restored=optimized.replace(c.SphereStationShaderOptimization.source+'\n',oldStation).replace('int stationCandidates=stationLightMask(q);if(candidates==0&&stationCandidates==0)return 1.;','if(candidates==0&&uStation==0)return 1.;').replace('if(!blocked&&stationCandidates!=0)blocked=stationHitMasked(q,d,stationCandidates)<starT;','if(!blocked&&uStation==1)blocked=stationHit(q,d)<starT;');
 assert.equal(restored,original,'Only the declared station optimization changes '+name);
}
console.log('PASS station optimization preserves all other shader bytes and sample counts');
