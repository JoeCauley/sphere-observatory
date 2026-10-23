'use strict';
// Append-only successor. Prior CHECK/REVIEW files are read and never rewritten.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const review=__dirname,W=path.dirname(review),author=path.join(W,'main-ordinary-bridge-work-2026-10-22-01');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function pin(p){const b=fs.readFileSync(p);return {path:p.replaceAll('\\','/'),bytes:b.length,sha256:sha(b)};}
function read(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
function write(n,v){fs.writeFileSync(path.join(review,n),typeof v==='string'?v:JSON.stringify(v,null,2)+String.fromCharCode(10),{flag:'wx'});}
const oldCheckPin=pin(path.join(review,'CHECK.json'));assert.equal(oldCheckPin.sha256,'a90764493492d099c91a019bcda365e332eb3216545ea5b1d75a07d33eaf0c89');
const oldCheck=read(oldCheckPin.path),oldReviewPin=pin(path.join(review,'REVIEW.json')),oldReview=read(oldReviewPin.path);
assert.equal(oldReviewPin.sha256,'0feb53c440761229f82492cc101f25cd42e56d9c4453e05c94e6711e1875d128');
for(const p of oldCheck.artifacts)assert.deepStrictEqual(pin(p.path),p,'Prior artifact mutated');
const expectedFinal={
 'CHECK.json':{bytes:4274,sha256:'60aa0a234480b752531ab2f7046864e7b83f79182ae0bb2ed09b6c6dc08b0dd4'},
 'scheduling-obstruction.json':{bytes:2829,sha256:'23336546825f4a62573c45832b87c17e15d6824b17d7b3c74670147bb2ff54a6'},
 'current-named-operation-graph.json':{bytes:12631,sha256:'6959b0615bd5d7931c02e3d9bb4f4a8ec345231da1f6758a1c69d9ed1083f732'},
 'source-check.json':{bytes:1294,sha256:'234706e62d76db33a659f581d175bb32a1ee8e9ff8c04a44354f767f3957ecbc'}
};
const finalPins=Object.entries(expectedFinal).map(([n,e])=>{const p=pin(path.join(author,n));assert.equal(p.bytes,e.bytes);assert.equal(p.sha256,e.sha256);return p;});
const finalAuthorCheck=read(path.join(author,'CHECK.json'));
for(const p of finalAuthorCheck.artifacts){const actual=pin(path.join(author,p.path));assert.equal(actual.bytes,p.bytes);assert.equal(actual.sha256,p.sha256,'Author artifact not frozen '+p.path);}
const obstruction=read(path.join(author,'scheduling-obstruction.json')),graph=read(path.join(author,'current-named-operation-graph.json')),sourceCheck=read(path.join(author,'source-check.json'));
assert.equal(obstruction.actualDebits.cap,4096);assert.equal(obstruction.actualDebits.surfaceFee,128);assert.equal(obstruction.actualDebits.stage7SurfacePayments,2);assert.equal(obstruction.actualDebits.batchFee,3584);assert.equal(obstruction.actualDebits.following,64);assert.equal(obstruction.actualDebits.remainingForVisitAtBest,192);assert.equal(obstruction.actualDebits.standaloneDemandedV6Maximum,448);
assert.deepStrictEqual(obstruction.proposedVocabularyLowerBound.terms,{unconditionalDemandNativeRows:57,baseConstructionCheck:54,fiveBindingLive:75,repeatedPortRendererState:14});assert.equal(obstruction.proposedVocabularyLowerBound.total,200);
assert(obstruction.sourceClaimScope.includes('joint managed-demanded v7'));assert(obstruction.sourceClaimScope.includes('Standalone demanded v6'));assert(obstruction.noTableSelected&&obstruction.noLimitsChanged&&obstruction.noSourcesChanged);
assert.equal(graph.nodes.length,43);const byId=new Map(graph.nodes.map(n=>[n.id,n]));assert.equal(byId.size,43);
const calculated=new Map(),pending=new Set();function total(id){assert(byId.has(id),'Unknown graph child '+id);if(calculated.has(id))return calculated.get(id);assert(!pending.has(id),'Graph cycle');pending.add(id);const n=byId.get(id);let sum=n.own;assert(Number.isSafeInteger(sum)&&sum>=0);for(const[child,multiplier]of Object.entries(n.terms)){assert(Number.isSafeInteger(multiplier)&&multiplier>=0);sum+=multiplier*total(child);}assert.equal(sum,n.total,id+' total mismatch');pending.delete(id);calculated.set(id,sum);return sum;}
for(const id of byId.keys())total(id);assert.equal(total('WholeBridgeAroundMain'),1426);assert.equal(total('WholeBridgeClose'),111);assert.equal(total('ConstructionCheck'),54);assert.equal(total('BindingLive'),15);assert.equal(total('BasePublishedParent'),10);
const projection=graph.nodes.map(n=>({id:n.id,own:n.own,terms:n.terms,total:n.total}));
assert(sourceCheck.all521MatchC4Inventory&&sourceCheck.nullTable&&sourceCheck.unconditionalHostGate);assert.equal(sourceCheck.sourceFiles,521);assert.equal(sourceCheck.mainPermission,false);
const inventory=read(oldReview.c4Inventory.path),root=oldReview.source;assert.equal(inventory.length,521);for(const row of inventory){const p=pin(path.join(root,row.path));assert.equal(p.sha256,row.sha256);assert.equal(p.bytes,row.bytes);}
for(const p of oldReview.sourcePins)assert.deepStrictEqual(pin(p.path),{path:p.path,bytes:p.bytes,sha256:p.sha256});
const lineChecks=[
 {file:'biome-service/native/main-baseline-owner.js',line:242,includes:'owner=freeze({createClosedSteadyFacet'},
 {file:'biome-service/native/main-baseline-owner.js',line:260,includes:'checkPublishedTextureParent(child,key,children)'},
 {file:'biome-service/native/main-finish-storage-owner.js',line:55,includes:'function closeContent(record)'},
 {file:'biome-service/native/main-finish-storage-owner.js',line:56,includes:'function retainContent()'},
 {file:'biome-service/native/main-finish-storage-owner.js',line:74,includes:'function withContentFromBaseline('}
];
for(const row of lineChecks){const line=fs.readFileSync(path.join(root,row.file),'utf8').split(/\r?\n/)[row.line-1];assert(line.includes(row.includes));row.actualLineSha256=sha(Buffer.from(line));}
const base=fs.readFileSync(path.join(root,'biome-service/native/main-baseline-owner.js'),'utf8');assert(base.includes('surfaceProfile=managedSurfaceProfile||p.format===SURFACE_FORMAT'));assert(base.includes('demandProfile=jointSurfaceDemand||p.format===DEMANDED_BRIDGE_FORMAT'));assert(base.includes('const ORDINARY_BRIDGE_WORK=null;'));
const superseded=oldReview.derivationPins.filter(p=>Object.keys(expectedFinal).includes(path.basename(p.path))).map(p=>({old:p,current:pin(p.path),disposition:'Old pin preserved; current mutable path explicitly superseded by final author CHECK.'}));assert.equal(superseded.length,3);assert(superseded.every(x=>x.old.sha256!==x.current.sha256));
const recoveryCandidates=[];function findHistory(dir,depth){if(depth>5)return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,e.name);if(e.isDirectory())findHistory(full,depth+1);else if(e.isFile()&&e.name.endsWith('.json')){const size=fs.statSync(full).size;if(superseded.some(x=>x.old.bytes===size))recoveryCandidates.push(pin(full));}}}for(const e of fs.readdirSync(author,{withFileTypes:true}))if(e.isDirectory())findHistory(path.join(author,e.name),0);
const historicalInputRecovery=superseded.map(x=>({old:x.old,matches:recoveryCandidates.filter(p=>p.bytes===x.old.bytes&&p.sha256===x.old.sha256),verified:recoveryCandidates.some(p=>p.bytes===x.old.bytes&&p.sha256===x.old.sha256)}));
assert(historicalInputRecovery.every(x=>x.verified),'Expected exact reconstructed historical inputs');
const recoveryManifest=pin(path.join(author,'attempt/input-before-final-scope-01/RECOVERY.json'));assert.equal(recoveryManifest.sha256,'203d8bb55ca98e7294dd9c8999dc2925ea479c9e7ecb7b6c041c7a358dccb221');
const historicalSourceCheck=historicalInputRecovery.find(x=>path.basename(x.old.path)==='source-check.json');const priorSourceCheck=read(historicalSourceCheck.matches[0].path),currentSourceCheckWithoutTime={...sourceCheck},priorSourceCheckWithoutTime={...priorSourceCheck};delete currentSourceCheckWithoutTime.utc;delete priorSourceCheckWithoutTime.utc;assert.deepStrictEqual(priorSourceCheckWithoutTime,currentSourceCheckWithoutTime);
const historicalSchedule=historicalInputRecovery.find(x=>path.basename(x.old.path)==='scheduling-obstruction.json'),priorSchedule=read(historicalSchedule.matches[0].path);assert.deepStrictEqual(priorSchedule.proposedVocabularyLowerBound,obstruction.proposedVocabularyLowerBound.conclusion===priorSchedule.proposedVocabularyLowerBound.conclusion?obstruction.proposedVocabularyLowerBound:{...obstruction.proposedVocabularyLowerBound,conclusion:priorSchedule.proposedVocabularyLowerBound.conclusion});for(const[k,v]of Object.entries(priorSchedule.actualDebits))assert.deepStrictEqual(obstruction.actualDebits[k],v); 
const oldGraph=historicalInputRecovery.find(x=>path.basename(x.old.path)==='current-named-operation-graph.json');let exactOldGraphNumericComparison='OLD_BYTES_NOT_VERIFIED_AT_THIS_SUCCESSOR_SEAL';if(oldGraph.verified){const recovered=read(oldGraph.matches[0].path);assert.deepStrictEqual(recovered.nodes.map(n=>({id:n.id,own:n.own,terms:n.terms,total:n.total})),projection);exactOldGraphNumericComparison='ALL_43_NODE_OWN_TERMS_TOTAL_VALUES_EXACTLY_IDENTICAL';}
const amendment={format:'sphere-independent-bridge-input-supersession-amendment/2',utc:new Date().toISOString(),status:'PASS_FINAL_INPUT_BYTES_NUMBERS_AND_V7_BRANCH_PARTITION_REVALIDATED',supersedesForCurrentInputResolution:oldCheckPin,preservedOldReview:oldReviewPin,oldReviewAndAllArtifactsUnchanged:true,finalAuthorCheck:finalPins[0],finalInputPins:finalPins.slice(1),supersededInputPins:superseded,historicalInputRecovery,recoveryManifest,exactOldGraphNumericComparison,
 validation:{allFinalAuthorArtifactsMatchCheck:true,all521C4FilesStillMatchFrozenInventory:true,all20OldReviewedSourcePinsUnchanged:true,graphNodes:43,allGraphDependencyArithmeticVerified:true,graphNumericProjectionSha256:sha(Buffer.from(JSON.stringify(projection))),proposedWholeBridgeAroundMain:1426,proposedWholeBridgeClose:111,readinessLower:200,actualFixedDebitVisitMaximumV7:192,standaloneV6OptimisticMaximum:448,lineChecks},
 findingsRetained:{vocabulary:'Pinned proposed named resource/API/state/row/native vocabulary only; no AST/event tariff or selected fee.',v7:'Only joint managed demanded v7 has two Surface128 debits in the reviewed stage7 path, giving V<=192 and proposed readiness V>=200.',v6:'Standalone demanded v6 has no Surface payments; its analogous optimistic upper448 does not establish the192/200 contradiction.',earlier228:'Rejected because DemandPort42 was an upper envelope. Final lower is57+54+75+14=200.',nextStep:'Independently derive actual versioned readiness/retention work separation with fresh non-replaying currentness, explicit disjoint payer and fail/defer semantics. No implementation or price selection follows.',scope:'Source scheduling obstruction conditional on payer partition/vocabulary; not an observed Main stall or technology impossibility. Broader1426/111 graph values are arithmetically rechecked proposed envelopes, not independently promoted whole-graph source qualification.'},
 history:'Original CHECK.json/REVIEW.json and their input hashes remain byte-identical. Three paths were regenerated after that seal. This amendment explicitly adopts the final author CHECK and replacement pins; it does not silently repair prior pins. Recovery is claimed only for archived bytes independently matching each exact old hash. Any missing recovery remains an explicit stale-input history.',
 noProductSourceChange:true,noTableSelection:true,noLimitsChange:true,noBrowserServerGitActions:true,P05:'OPEN',Main:'HELD',completeWorkContract:false,fullColdQualified:false,physicalNativeHeapTiming:'UNQUALIFIED_OR_UNMEASURED'};
write('REVIEW-AMENDMENT-02.json',amendment);
write('READ-FIRST-02.md',[
 '# Successor input-pin amendment',
 '',
 'CHECK-02.json is the current independent receipt. Original CHECK.json, REVIEW.json, READ-FIRST.md and simulation-01.json remain unchanged as historical evidence.',
 '',
 'Three author JSON inputs were regenerated after the original seal. REVIEW-AMENDMENT-02.json records both old and replacement hashes and binds final author CHECK60aa0a234480b752531ab2f7046864e7b83f79182ae0bb2ed09b6c6dc08b0dd4. Exact archived recovery is reported per input; absent recovery is explicitly retained as stale-input history.',
 '',
 'All521 C4 source files still match the frozen inventory. The43-node graph dependency arithmetic, proposed1426/111 aggregates, corrected source references and explicit v7/v6 partition were checked. The bounded conclusion remains conditional: joint v7 requires V>=200 while its actual fixed debit capacity permits V<=192. Standalone v6 has no such192 upper. No source, limit, table, browser, server or Git action occurred.',
 '',
 'This successor updates current evidence identities only. Price selection, the complete work contract, full Main, cold/native/physical qualification and P05 acceptance remain held.',
 ''
 ].join(String.fromCharCode(10)));
const artifacts=['amend-input-pins-02.cjs','REVIEW-AMENDMENT-02.json','READ-FIRST-02.md'].map(n=>pin(path.join(review,n)));
for(const p of [...finalPins,...oldCheck.artifacts,oldCheckPin,...artifacts,...historicalInputRecovery.flatMap(x=>x.matches),recoveryManifest])assert.deepStrictEqual(pin(p.path),p,'Input drift during amendment');
write('CHECK-02.json',{format:'sphere-independent-bridge-successor-check/2',utc:new Date().toISOString(),status:amendment.status,supersedesForCurrentEvidence:oldCheckPin,originalReview:oldReviewPin,originalArtifactsPreserved:true,finalAuthorCheck:finalPins[0],replacementInputPins:finalPins.slice(1),historicalRecoveredInputs:historicalInputRecovery.filter(x=>x.verified).length,historicalRecoveryComplete:historicalInputRecovery.every(x=>x.verified),recoveryManifest,exactOldGraphNumericComparison,artifacts,sourceFilesStillExact:521,reviewedSourcePinsStillExact:20,namedNodesArithmeticVerified:43,proposedGraph1426And111:true,conditionalV7Lower:200,actualV7VisitMaximum:192,standaloneV6Bound448:true,sourceChanged:false,tableSelected:false,P05:'OPEN',Main:'HELD'});
console.log(JSON.stringify({status:amendment.status,CHECK02:pin(path.join(review,'CHECK-02.json')),recovered:historicalInputRecovery.filter(x=>x.verified).length,exactOldGraphNumericComparison}));
