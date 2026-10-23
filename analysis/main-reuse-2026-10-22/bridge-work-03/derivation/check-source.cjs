'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const W='I:/Sphere/work/biome-pack-service-main-2026-10-20T10-35-00',C4=W+'/main-startup-draw-helper-2026-10-22-01/main-startup-stage-candidate-04',S=C4+'/source',OUT=__dirname;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pin=p=>{const b=fs.readFileSync(p);return {path:p.replaceAll('\\','/'),bytes:b.length,sha256:sha(b)};};
const write=(p,x)=>fs.writeFileSync(path.join(OUT,p),JSON.stringify(x,null,2)+'\n');
const files=[];function walk(d){for(const x of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,x.name);if(x.isDirectory())walk(p);else files.push(p);}}walk(S);
const inv=files.map(p=>({...pin(p),path:path.relative(S,p).replaceAll('\\','/')})).sort((a,b)=>a.path.localeCompare(b.path));
const saved=JSON.parse(fs.readFileSync(C4+'/source-inventory-01.json','utf8'));
const old=new Map(saved.map(x=>[x.path,x]));assert.equal(inv.length,521);assert.equal(saved.length,521);
for(const r of inv){assert.deepStrictEqual(r,old.get(r.path));}
const ranges={
 'biome-service/native/main-baseline-owner.js':[[10,10],[49,66],[67,112],[159,167],[219,221],[237,245],[257,285]],
 'biome-service/native/main-texture-binding-owner.js':[[27,36],[56,63],[112,135],[169,180],[229,235]],
 'biome-service/native/main-finish-storage-owner.js':[[6,15],[34,49],[68,80]],
 'biome-service/native/main-default-surface-facts.js':[[16,24],[88,95],[109,109],[123,126],[159,164],[173,182]],
 'biome-service/native/main-baseline-resource-records.js':[[9,20],[49,59],[74,86],[100,102]],
 'biome-service/native/root-program-binding.js':[[65,77]],
 'biome-service/native/shared-gpu-backend.js':[[42,42],[331,331]],
 'biome-service/native/positions-backend.js':[[105,105]],
 'biome-service/native/main-demanded-array-content-owner.js':[[14,28],[34,39],[88,95]],
 'biome-service/native/resource-leases.js':[[221,224],[285,286],[397,405],[606,606],[649,649]],
 'renderer.js':[[83,87],[112,119],[337,337],[358,358],[372,372],[477,477]],
 'biomes.js':[[39,39]],'hero-textures.js':[[10,10]],'world-textures.js':[[33,33]],'wound-textures.js':[[12,12]],
 'surface-lighting.js':[[152,152]],'local-shadows.js':[[30,30]],'atmosphere.js':[[30,30]],
 'instanced-environment.js':[[218,218]],'meadow-canopy.js':[[109,110]]
};
const selected=new Set([...Object.keys(ranges),'biome-service/native/resource-leases.js','biome-service/metadata-budget.js','biome-service/native/source-admission.js','biome-service/records.js','biome-service/native/main-demanded-array-content-owner.js','biome-service/native/retained-demand-plan.js','app.js','surface-lighting.js','owned-main-bootstrap.js']);
write('source-inventory.json',inv);write('source-pins.json',[...selected].sort().map(p=>inv.find(x=>x.path===p)));
let excerpt='# Exact current C4 source excerpts\n\nThese are read-only excerpts, not executable substitutes or operation prices.\n';
for(const [p,rs] of Object.entries(ranges)){const ls=fs.readFileSync(path.join(S,p),'utf8').split(/\r?\n/);excerpt+='\n## '+p+'\n';for(const [a,b] of rs){excerpt+='\n```text\n';for(let i=a;i<=b;i++)excerpt+=i+': '+ls[i-1]+'\n';excerpt+='```\n';}}
fs.writeFileSync(path.join(OUT,'source-excerpts.md'),excerpt);
const template=W+'/ordinary-main-demand-work-contract-01/resource-api-coverage-02.json',t=JSON.parse(fs.readFileSync(template,'utf8'));
const comparison=t.sourcePins.map(p=>{const now=inv.find(r=>r.path===p.path);return {path:p.path,templateBytes:p.bytes,templateSha256:p.sha256,currentBytes:now?.bytes,currentSha256:now?.sha256,wholeFileExact:now?.sha256===p.sha256};});
write('source37-dependency-comparison.json',{template:pin(template),qualification:'Dependency template only; no numerical node or selected tariff inherited automatically.',comparison});
const base=fs.readFileSync(S+'/biome-service/native/main-baseline-owner.js','utf8');
assert(base.includes('const ORDINARY_BRIDGE_WORK=null;'));assert(base.includes("fail('ORDINARY_MAIN_HOST_ENVELOPE_UNQUALIFIED'"));
assert(base.includes('bridge.stage!==(demandProfile?8:6)'));
assert(base.includes('const CLOSED_CONTENT_WORK=null;'));
const demand=fs.readFileSync(S+'/biome-service/native/main-demanded-array-content-owner.js','utf8');
assert(demand.includes('const DEMANDED_CONTENT_WORK=null;'));assert(demand.includes('const PLAN_TOKEN_WORK=null;'));
assert(/APP_EXECUTION_ENABLED\s*=\s*false/.test(fs.readFileSync(S+'/owned-main-bootstrap.js','utf8')));
write('source-check.json',{status:'PASS_READ_ONLY_CURRENT_C4_PIN_CHECK',utc:new Date().toISOString(),source:S,sourceFiles:inv.length,all521MatchC4Inventory:true,inventory:pin(path.join(OUT,'source-inventory.json')),c4Seal:pin(C4+'/functional-seal-01.json'),source37Comparison:pin(path.join(OUT,'source37-dependency-comparison.json')),nullTable:true,unconditionalHostGate:true,mainPermission:false,sourceWrites:0,browserActions:0,serverActions:0,gitActions:0});
console.log(JSON.stringify({status:'PASS',files:inv.length,selectedPins:selected.size,source37WholeExact:comparison.filter(x=>x.wholeFileExact).map(x=>x.path),changedSince37:comparison.filter(x=>!x.wholeFileExact).map(x=>x.path)},null,2));
