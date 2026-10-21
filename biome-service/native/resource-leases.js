(() => {
'use strict';

// WORK ONLY. No renderer, driver, native heap or production admission claim.
// Backends own synchronous GPU creation/write/destruction; async work uses jobs.
const PHASES = new Set(['current', 'new', 'staging', 'retiring', 'neighbor', 'cache']);
const TIERS = new Set(['overview', 'surface', 'detail']);
const READY = ['visualCoverageReady', 'terrainAndCollisionReady', 'stateAndIdentityReady', 'conservativeBoundsReady'];
const BUDGET_KEYS = ['maxCpuBytes', 'maxGpuBufferBytes', 'maxGpuTextureBytes', 'maxTransientCpuBytes', 'maxTransientGpuBytes', 'maxJobs', 'maxStageRadiusM', 'maxUploadBytesPerFrame', 'maxPrepareOpsPerSlice'];
const HOST_KEYS = ['cpuResidentBytes', 'cpuTransientBytes', 'cpuTotalBytes', 'gpuBufferResidentBytes', 'gpuTextureResidentBytes', 'gpuTransientBytes', 'gpuTotalBytes', 'maxJobs', 'maxUploadBytesPerFrame', 'maxPrepareOpsPerSlice'];
const SERVICE_CPU_LIMIT = 32 * 1048576, SERVICE_GPU_LIMIT = 10 * 1048576;
const admittedServices = new WeakMap(), admittedHosts = new WeakSet();
const DEFAULT_DETACH = buffer => buffer.transfer(0);
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function invariant(condition, code, message) { if (!condition) fail(code, message); }
function integer(value, name, minimum = 0) { invariant(Number.isSafeInteger(value) && value >= minimum, 'INVALID_INPUT', name + ' must be an exact nonnegative integer'); return value; }
function exactKeys(value, keys, name) { invariant(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('|') === keys.slice().sort().join('|'), 'INVALID_INPUT', name + ' fields differ'); }
function sync(result, name) { invariant(!result || typeof result.then !== 'function', 'BACKEND_CONTRACT', name + ' must be synchronous'); return result; }
function blank() { return { cpuResidentBytes: 0, cpuTransientBytes: 0, gpuBufferResidentBytes: 0, gpuTextureResidentBytes: 0, gpuTransientBytes: 0 }; }
function dimensions(kind, memoryClass, bytes) {
  const d = blank();
  if (kind === 'cpu') d[memoryClass === 'resident' ? 'cpuResidentBytes' : 'cpuTransientBytes'] = bytes;
  else if (memoryClass === 'transient') d.gpuTransientBytes = bytes;
  else d[kind === 'gpu-buffer' ? 'gpuBufferResidentBytes' : 'gpuTextureResidentBytes'] = bytes;
  return d;
}
function totals(u) { return { cpu: u.cpuResidentBytes + u.cpuTransientBytes, gpu: u.gpuBufferResidentBytes + u.gpuTextureResidentBytes + u.gpuTransientBytes }; }

function createHost({ limits, backend, verifyPrepared, verifyBundle, createCpu = bytes => new ArrayBuffer(bytes), detachCpu = DEFAULT_DETACH, scheduleYield }) {
  exactKeys(limits, HOST_KEYS, 'Host limits');
  const hostLimits = Object.freeze({ ...limits });
  for (const key of HOST_KEYS) integer(hostLimits[key], key);
  invariant(hostLimits.maxJobs > 0 && hostLimits.maxPrepareOpsPerSlice > 0, 'INVALID_INPUT', 'Host jobs and work limits must be positive');
  invariant(backend && ['createGpu', 'destroyGpu', 'writeGpu', 'createFence', 'pollFence', 'destroyFence', 'loseContext', 'restoreContext'].every(key => typeof backend[key] === 'function'), 'INVALID_INPUT', 'Complete admitted backend adapter required');
  for(const key of ['createGpu','destroyGpu','writeGpu','createFence','pollFence','destroyFence','loseContext','restoreContext','submit','claimFailedCreation','verifyContextLoss'])if(backend[key])invariant(backend[key].constructor.name!=='AsyncFunction','BACKEND_CONTRACT','Backend '+key+' must be statically synchronous');
  invariant(typeof verifyPrepared === 'function' && typeof createCpu === 'function' && typeof detachCpu === 'function' && (!scheduleYield || typeof scheduleYield === 'function'), 'INVALID_INPUT', 'Host preparation verifier and CPU ownership adapters required');
  invariant(!verifyBundle||typeof verifyBundle==='function','INVALID_INPUT','Host bundle verifier must be callable');
  invariant(detachCpu!==DEFAULT_DETACH||typeof ArrayBuffer.prototype.transfer==='function','BACKEND_CONTRACT','Host runtime lacks the admitted detaching CPU ownership operation');
  const handles = new WeakMap(), readers = new WeakMap(), providers = new WeakMap(), requests = new WeakMap(), prepared = new WeakMap(), topologyCapabilities = new WeakMap(), bundles=new WeakMap();
  const ownerSet = new Set(), resources = new Set(), jobs = new Set(), preparedSet = new Set();
  const usage = blank(), peaks = blank();
  const phaseCounts = {};
  let logicalLeaseCount = 0, readerCount = 0, gpuReaderCount = 0, retiringCount = 0;
  let disposed = false, contextLost = false, current = null, serviceApi = null, hostTargetApi = null, generation = 0, slice = 0, frame = 0, work = 0, uploads = 0, drainIterator = null;
  const counters = { allocations: 0, creationFaults: 0, cacheHits: 0, logicalWork: 0, uploadedBytes: 0, uploadAttempts: 0, jobsAdmitted: 0, jobsPeak: 0, cancellationRefusals: 0, disposalFaults: 0 };
  function nextGeneration() { invariant(generation < Number.MAX_SAFE_INTEGER, 'GENERATION_EXHAUSTED', 'Private allocation counter exhausted'); return ++generation; }
  function liveHost() { invariant(!disposed, 'DISPOSED', 'Host resource owner is disposed'); }
  function owner(api, allowDisposed = false) { const o = providers.get(api); invariant(o, 'FOREIGN_OWNER', 'Unknown provider service'); if (!allowDisposed) { liveHost(); invariant(!o.disposed, 'DISPOSED', 'Provider resource owner is disposed'); } return o; }
  function canCharge(u, d, cap, provider = false) {
    const mapped = provider ? { cpuResidentBytes: 'maxCpuBytes', cpuTransientBytes: 'maxTransientCpuBytes', gpuBufferResidentBytes: 'maxGpuBufferBytes', gpuTextureResidentBytes: 'maxGpuTextureBytes', gpuTransientBytes: 'maxTransientGpuBytes' } : null;
    for (const key of Object.keys(u)) invariant(u[key] + d[key] <= cap[mapped ? mapped[key] : key], 'RESOURCE_BUDGET', key + ' reservation refused');
    if (!provider) { const t = totals(u), dt = totals(d); invariant(t.cpu + dt.cpu <= cap.cpuTotalBytes && t.gpu + dt.gpu <= cap.gpuTotalBytes, 'RESOURCE_BUDGET', 'Aggregate resident/transient reservation refused'); }
  }
  function change(u, d, sign, peak) { for (const key of Object.keys(u)) { u[key] += sign * d[key]; invariant(u[key] >= 0 && Number.isSafeInteger(u[key]), 'ACCOUNTING_DEFECT', 'Resource counter invalid'); if (peak) peak[key] = Math.max(peak[key], u[key]); } }
  function forgetDisposedOwner(o){if(o.disposed&&!o.jobs&&!o.leases.size&&Object.values(o.usage).every(n=>n===0))ownerSet.delete(o);}
  function addOwner(res, o) {
    let entry = res.owners.get(o);
    if (!entry) { canOwnerCharge(o, res.cost); change(o.usage, res.cost, 1, o.peaks); entry = { references: 0 }; res.owners.set(o, entry); }
    entry.references++;
  }
  function removeOwner(res, o) {
    const entry = res.owners.get(o); invariant(entry && entry.references > 0, 'ACCOUNTING_DEFECT', 'Owner reference underflow'); entry.references--;
    if (entry.references === 0 && !res.retiring) { change(o.usage, res.cost, -1); res.owners.delete(o); }
  }
  function token(res, o, phase, hostOwned = false) {
    const key = Object.freeze({}); const h = { res, owner: o, generation: res.generation, active: true, phase, hostOwned };
    addOwner(res, o); handles.set(key, h); res.leases.add(h); o.leases.add(h); logicalLeaseCount++; phaseCounts[phase] = (phaseCounts[phase] || 0) + 1; return key;
  }
  function retire(res) { if (!res.retiring) { res.retiring = true; retiringCount++; } }
  function lookup(key, o, allowHostOwned = false) {
    const h = handles.get(key); invariant(h && h.active && !h.res.destroyed && h.generation === h.res.generation, 'STALE_RELEASE', 'Foreign, stale or released allocation token');
    invariant(!o || h.owner === o, 'FOREIGN_OWNER', 'Resource belongs to another provider');
    invariant(allowHostOwned || !h.hostOwned, 'HOST_OWNED', 'Only host may release active support'); return h;
  }
  function gpuUsable(res){return res.kind==='cpu'||(!contextLost&&!res.invalidGpu&&!res.unsafeSubmission);}
  function requireSafe(res){invariant(res.kind==='cpu'||!res.unsafeSubmission,'COMMITTED_UNCERTAIN','Submitted resource authority is unresolved until actual context loss');}
  function maintenance(res, required = false) {
    const owners = res ? Array.from(res.owners.keys()) : [];
    const ready = work < hostLimits.maxPrepareOpsPerSlice && owners.every(o => o.work < o.limits.maxPrepareOpsPerSlice);
    if (!ready) { if (required) fail('WORK_QUOTA', 'Shared maintenance slice exhausted'); return false; }
    work++; counters.logicalWork++; for (const o of owners) o.work++; return true;
  }
  function tryDestroy(res, charged = false) {
    if (!res.retiring || res.destroyed || res.creating || res.leases.size || res.readers.size) return;
    if(res.unsafeSubmission&&!res.invalidGpu)return;
    if (!charged && !maintenance(res)) return;
    try {
      if (res.kind !== 'cpu' && res.lastUsed && !res.invalidGpu && !res.fence && !res.fenceCleared) {
        if (!maintenance(res)) return;
        res.fence = sync(backend.createFence(res.value), 'GPU retirement fence'); invariant(res.fence, 'BACKEND_CONTRACT', 'Fence missing'); res.fenceFault = null;
      }
      if (res.fence) {
        if (!res.invalidGpu) { if (!maintenance(res)) return; if (!sync(backend.pollFence(res.fence), 'Fence polling')) return; }
        if (!maintenance(res)) return; sync(backend.destroyFence(res.fence), 'Fence disposal'); res.fence = null; res.fenceCleared = true;
      }
      if (res.kind !== 'cpu') { if (!maintenance(res)) return; sync(backend.destroyGpu(res.value), 'GPU disposal'); }
      else { sync(detachCpu(res.value), 'CPU disposal'); invariant(res.value.byteLength === 0, 'BACKEND_CONTRACT', 'CPU disposal must detach all escaped views'); }
    } catch (error) { counters.disposalFaults++; res.disposalError = error; return; }
    res.value = null; res.destroyed = true; resources.delete(res); retiringCount--; change(usage, res.cost, -1);
    for (const [o] of res.owners) {change(o.usage, res.cost, -1);forgetDisposedOwner(o);}
    res.owners.clear();
  }
  function drop(h) {
    invariant(h.active && !h.res.destroyed, 'STALE_RELEASE', 'Allocation already released'); const res = h.res;
    h.active = false; res.leases.delete(h); h.owner.leases.delete(h); logicalLeaseCount--; phaseCounts[h.phase]--;
    if (!res.leases.size) {
      retire(res);
    }
    removeOwner(res, h.owner);
    tryDestroy(res);
  }
  function allocate(o, kind, bytes, options = {}, job = null, physicalFactory = null) {
    liveHost(); invariant(!o.disposed, 'DISPOSED', 'Provider disposed'); integer(bytes, 'Resource byte length', 1);
    invariant(kind === 'cpu' || kind === 'gpu-buffer' || kind === 'gpu-texture', 'INVALID_INPUT', 'Unknown resource kind');
    const memoryClass = options.memoryClass || 'resident', phase = options.phase || 'new', contentKey = options.contentKey || '', layout = options.layout || 'opaque';
    invariant(memoryClass === 'resident' || memoryClass === 'transient', 'INVALID_INPUT', 'Unknown resource budget class'); invariant(PHASES.has(phase), 'INVALID_INPUT', 'Unknown lifetime phase'); invariant(typeof contentKey === 'string' && contentKey.length <= 256, 'INVALID_INPUT', 'Content key too large');
    invariant(kind === 'cpu' || !contextLost, 'CONTEXT_LOST', 'GPU allocation requires current host context');
    invariant(['opaque', 'positions-f32x3', 'indices-u16'].includes(layout) && (kind !== 'cpu' || layout === 'opaque'), 'INVALID_INPUT', 'Unknown GPU layout');
    if (job) jobCheck(job);
    const cost = dimensions(kind, memoryClass, bytes); canCharge(usage, cost, hostLimits); canOwnerCharge(o, cost);
    consume(o);
    const res = { generation: nextGeneration(), kind, bytes, memoryClass, contentKey, layout, cost, uploadedPrefix: 0, creating:true, value: null, owners: new Map(), leases: new Set(), readers: new Set(), retiring: false, destroyed: false, lastUsed: false, invalidGpu: false, fence: null, fenceFault: null, fenceCleared: false };
    // Reservation is visible to the backend before physical creation starts.
    change(usage, cost, 1, peaks); resources.add(res);
    let key;
    try {
      key = token(res, o, phase);
      if(kind==='cpu')res.value=sync(createCpu(bytes),'CPU allocation');
      else{res.value=(physicalFactory||(()=>backend.createGpu(kind,bytes,Object.freeze({layout}))))();if(res.value&&typeof res.value.then==='function'){res.unsafeSubmission=true;fail('BACKEND_CONTRACT','Unexpected asynchronous physical GPU creation has no safe completion proof');}}
      res.creating=false;liveHost();invariant(!o.disposed,'DISPOSED','Provider disposed during physical creation');if(job)jobCheck(job);invariant(kind==='cpu'||(!contextLost&&!res.invalidGpu),'CONTEXT_LOST','Context lost during physical creation');
      invariant(res.value && (kind !== 'cpu' || res.value instanceof ArrayBuffer) && res.value.byteLength === bytes, 'BACKEND_CONTRACT', 'Backend allocation byte length differs');
      counters.allocations++; if (job) { job.handles.add(key); handles.get(key).job = job; } return key;
    } catch (error) {
      res.creating=false;
      if(kind!=='cpu'&&!res.value&&typeof backend.claimFailedCreation==='function'){const retained=sync(backend.claimFailedCreation(error),'Failed GPU allocation retention');if(retained){invariant(retained.byteLength===bytes,'BACKEND_CONTRACT','Retained failed physical allocation length differs');res.value=retained;res.unsafeSubmission=true;}}
      if(kind!=='cpu'&&error?.code==='COMMITTED_UNCERTAIN')res.unsafeSubmission=true;
      counters.creationFaults++;
      if (key) { const h = handles.get(key); if(h.active){h.active = false; h.owner.leases.delete(h); res.leases.delete(h); logicalLeaseCount--; phaseCounts[h.phase]--;} }
      retire(res);
      if (res.value) { tryDestroy(res); }
      else { res.value = null; res.destroyed = true; resources.delete(res); retiringCount--; change(usage, cost, -1); for (const [owned] of res.owners) change(owned.usage, cost, -1); res.owners.clear(); }
      throw error;
    }
  }
  function closeReader(r) { invariant(r.active, 'STALE_RELEASE', 'CPU reader already closed'); r.active=false; r.value=null; r.res.readers.delete(r); readerCount--; if(r.job)r.job.readers.delete(r); removeOwner(r.res,r.owner); tryDestroy(r.res); }
  function borrow(o, key, allowHostOwned = false) {
    const h = lookup(key, o, allowHostOwned); invariant(h.res.kind === 'cpu', 'INVALID_INPUT', 'Only CPU buffers can be read');
    const readerKey = Object.freeze({}), r = { res: h.res, owner: o, job: h.job && h.job.live ? h.job : null, active: true, value: new Uint8Array(h.res.value) }; if(r.job)r.job.readers.add(r);
    addOwner(r.res, o); r.res.readers.add(r); readerCount++; readers.set(readerKey, r);
    return Object.freeze({ token: readerKey, get value() { invariant(r.active, 'STALE_RELEASE', 'CPU reader is closed'); return r.value; }, close() { closeReader(r); } });
  }
  function consume(o, units = 1) {
    integer(units, 'Logical work', 1); liveHost(); invariant(!o.disposed, 'DISPOSED', 'Provider disposed');
    invariant(work + units <= hostLimits.maxPrepareOpsPerSlice && o.work + units <= o.limits.maxPrepareOpsPerSlice, 'WORK_QUOTA', 'Logical preparation slice exhausted');
    work += units; o.work += units; counters.logicalWork += units;
  }
  function canOwnerCharge(o, d) { canCharge(o.usage, d, o.limits, true); if (o.category === 'service') { const t = totals(o.usage), dt = totals(d); invariant(t.cpu + dt.cpu <= SERVICE_CPU_LIMIT && t.gpu + dt.gpu <= SERVICE_GPU_LIMIT, 'RESOURCE_BUDGET', 'Fixed service metadata aggregate cap exceeded'); } }
  function takeUpload(o, bytes) {
    integer(bytes, 'Upload bytes', 1); liveHost(); invariant(!o.disposed, 'DISPOSED', 'Provider disposed');
    invariant(uploads + bytes <= hostLimits.maxUploadBytesPerFrame && o.uploads + bytes <= o.limits.maxUploadBytesPerFrame, 'UPLOAD_QUOTA', 'Host/provider per-frame upload quota exceeded');
    uploads += bytes; o.uploads += bytes; counters.uploadAttempts++;
  }
  function credits(o, uploadQuantum) {
    return Object.freeze({
      takePrepareCredits(requestedOps) { integer(requestedOps, 'Requested preparation credits', 1); liveHost(); invariant(!o.disposed, 'DISPOSED', 'Provider disposed'); const granted = Math.min(requestedOps, hostLimits.maxPrepareOpsPerSlice - work, o.limits.maxPrepareOpsPerSlice - o.work); if (granted) consume(o, granted); return granted; },
      takeUploadCredits(requestedBytes) { integer(requestedBytes, 'Requested upload credits', 1); liveHost(); invariant(!o.disposed, 'DISPOSED', 'Provider disposed'); const granted = Math.floor(Math.min(requestedBytes, hostLimits.maxUploadBytesPerFrame - uploads, o.limits.maxUploadBytesPerFrame - o.uploads) / uploadQuantum) * uploadQuantum; if (granted) takeUpload(o, granted); return granted; }
    });
  }
  function getPrepared(key, activeOnly = false) {
    const p = prepared.get(key); invariant(p && !p.released && (!activeOnly || (current&&current.members.includes(p))), 'STALE_RELEASE', 'Unknown, released or noncurrent prepared token'); return p;
  }
  function gpuUse(keys, callback, uploadBytes=0){
    liveHost();invariant(!contextLost,'CONTEXT_LOST','Host context lost');invariant(Array.isArray(keys)&&keys.length>0&&new Set(keys).size===keys.length,'INVALID_INPUT','Unique exact GPU leases required');invariant(typeof callback==='function'&&callback.constructor.name!=='AsyncFunction','BACKEND_CONTRACT','Host GPU callback must be statically synchronous');
    const hs=keys.map(key=>lookup(key,null,true));for(const h of hs)requireSafe(h.res);invariant(hs.every(h=>h.res.kind!=='cpu'&&!h.res.invalidGpu&&!h.owner.disposed),'NOT_READY','GPU lease is not usable');const owners=Array.from(new Set(hs.map(h=>h.owner)));integer(uploadBytes,'Host texture upload bytes');
    invariant(work<hostLimits.maxPrepareOpsPerSlice&&owners.every(o=>o.work<o.limits.maxPrepareOpsPerSlice),'WORK_QUOTA','Shared host GPU use work quota exhausted');
    if(uploadBytes){invariant(hs.length===1&&hs[0].res.kind==='gpu-texture','INVALID_INPUT','Texture upload needs one exact texture lease');const o=hs[0].owner;invariant(uploads+uploadBytes<=hostLimits.maxUploadBytesPerFrame&&o.uploads+uploadBytes<=o.limits.maxUploadBytesPerFrame,'UPLOAD_QUOTA','Shared texture upload quota exhausted');}
    work++;counters.logicalWork++;for(const o of owners)o.work++;if(uploadBytes)takeUpload(hs[0].owner,uploadBytes);
    const uses=hs.map(h=>{h.res.lastUsed=true;const use={res:h.res,owner:h.owner};addOwner(h.res,h.owner);h.res.readers.add(use);gpuReaderCount++;return use;});
    try{const result=callback(Object.freeze(hs.map(h=>Object.freeze({value:h.res.value,layout:h.res.layout,bytes:h.res.bytes}))));if(result&&typeof result.then==='function'){for(const h of hs)h.res.unsafeSubmission=true;fail('BACKEND_CONTRACT','Unexpected asynchronous GPU use has no safe completion proof');}if(uploadBytes)counters.uploadedBytes+=uploadBytes;return result;}catch(error){if(error?.code==='COMMITTED_UNCERTAIN')for(const h of hs)h.res.unsafeSubmission=true;throw error;}
    finally{for(const use of uses){use.res.readers.delete(use);gpuReaderCount--;removeOwner(use.res,use.owner);tryDestroy(use.res);}}
  }
  function jobCheck(job) { invariant(!disposed && !job.owner.disposed && !job.controller.signal.aborted && job.request === job.owner.request, 'CANCELLED', 'Preparation generation cancelled or superseded'); }
  function releasePrepared(p) {
    if(current&&current.members.includes(p)){releaseBundle(current);return;}
    invariant(!p.released, 'STALE_RELEASE', 'Prepared lease already released'); p.released = true; preparedSet.delete(p);
    for (const key of p.keys) { const h = handles.get(key); if (h && h.active) drop(h); }
    p.active=false;
  }
  function releaseBundle(b){invariant(b&&!b.released,'STALE_RELEASE','Bundle already released');b.released=true;if(current===b)current=null;for(const p of b.members)if(!p.released)releasePrepared(p);}
  function activateMembers(keys,expected){
    liveHost();invariant(!contextLost,'CONTEXT_LOST','Lost context cannot activate visual coverage');invariant(Array.isArray(keys)&&keys.length>0&&new Set(keys).size===keys.length,'INVALID_INPUT','Unique complete bundle members required');const ownedKeys=keys.slice(),old=current;invariant(old===expected,'STALE_CURRENT','Active view bundle changed before commit');
    const ps=ownedKeys.map(key=>getPrepared(key));function validate(){liveHost();invariant(!contextLost,'CONTEXT_LOST','Lost context cannot activate visual coverage');invariant(current===old,'STALE_CURRENT','Bundle changed during host verification');for(const p of ps){const retained=old&&old.members.includes(p);invariant(!p.released&&!p.owner.disposed&&((p.active&&retained)||(!p.active&&p.request===p.owner.request)),'STALE_REQUEST','Bundle candidate is not current or retained coverage');for(const key of p.keys){const res=lookup(key,p.owner,!!retained).res;requireSafe(res);invariant(!res.invalidGpu,'NOT_READY','Bundle resource context lost');}}}
    validate();if(ps.length>1){invariant(verifyBundle,'BUNDLE_VERIFIER_REQUIRED','Multi-member coverage requires an actual host bundle verifier');const descriptions=Object.freeze(ps.map(p=>Object.freeze({contextDigest:p.contextDigest,tier:p.tier,retained:!!old&&old.members.includes(p),readiness:p.readiness,resources:Object.freeze(p.keys.map(key=>{const h=lookup(key,p.owner,true);return Object.freeze({kind:h.res.kind,bytes:h.res.bytes,layout:h.res.layout});}))})));invariant(sync(verifyBundle(descriptions),'Bundle proof verification')===true,'NOT_READY','Host complete coverage/support/identity bundle proof refused');validate();}
    const transfers=[];try{for(const p of ps)if(!p.active){const source=p.keys.map(key=>lookup(key,p.owner)),t={p,source,next:[]};transfers.push(t);for(const h of source)t.next.push(token(h.res,h.owner,'current',true));}}catch(error){for(const t of transfers)for(const key of t.next){const h=handles.get(key);if(h.active)drop(h);}throw error;}
    // All replacements have ownership before the single synchronous handoff.
    for(const t of transfers){for(const h of t.source)drop(h);t.p.keys=t.next;t.p.active=true;}
    const key=Object.freeze({}),bundle={key,members:ps,memberKeys:ownedKeys,released:false};bundles.set(key,bundle);current=bundle;if(old){old.released=true;for(const p of old.members)if(!ps.includes(p))releasePrepared(p);}return key;
  }
  function cancelOwnerJobs(o) { for (const job of jobs) if (job.owner === o) job.controller.abort(); }
  function closeTopology(cap){if(cap.closed)return;cap.closed=true;cap.request.topology.delete(cap);const h=handles.get(cap.key);if(h.active)drop(h);}
  function adoptTopology(job,key){jobCheck(job);const cap=topologyCapabilities.get(key);invariant(cap&&!cap.closed&&cap.request===job.request,'STALE_REQUEST','Topology capability is not this exact host-admitted request');const source=lookup(cap.key,job.owner,true);requireSafe(source.res);invariant(source.res.kind==='gpu-buffer'&&source.res.layout==='indices-u16'&&!source.res.invalidGpu&&!contextLost,'NOT_READY','Shared immutable topology is unavailable');consume(job.owner);const adopted=token(source.res,job.owner,'new');handles.get(adopted).job=job;job.handles.add(adopted);counters.cacheHits++;closeTopology(cap);return adopted;}
  function createProvider(admittedBudgets, category = 'provider') {
    liveHost(); exactKeys(admittedBudgets, BUDGET_KEYS, 'Admitted manifest budgets'); const caps = Object.freeze({ ...admittedBudgets });
    for (const key of BUDGET_KEYS.filter(key => key !== 'maxStageRadiusM')) integer(caps[key], key);
    invariant(caps.maxJobs > 0 && caps.maxPrepareOpsPerSlice > 0 && Number.isFinite(caps.maxStageRadiusM) && caps.maxStageRadiusM > 0, 'INVALID_INPUT', 'Manifest scheduling/domain limits must be positive');
    const o = { category, limits: caps, usage: blank(), peaks: blank(), leases: new Set(), disposed: false, request: null, jobs: 0, work: 0, uploads: 0 };
    const api = Object.freeze({
      allocateCpu: (bytes, options) => allocate(o, 'cpu', bytes, options),
      allocateGpu: (kind, bytes, options) => allocate(o, kind, bytes, options),
      borrowCpu: key => { owner(api); return borrow(o, key); },
      release: key => { owner(api); drop(lookup(key, o)); },
      consumeWork: units => consume(o, units),
      cacheHit(key) { owner(api); requireSafe(lookup(key, o).res); consume(o); counters.cacheHits++; return key; },
      upload(gpuKey, readerToken, offset, bytes, sourceOffset = 0) {
        owner(api); invariant(!contextLost, 'CONTEXT_LOST', 'Upload context lost'); const h = lookup(gpuKey, o), r = readers.get(readerToken);
        requireSafe(h.res);invariant(h.res.kind !== 'cpu' && !h.res.invalidGpu && r && r.active && r.owner === o, 'INVALID_INPUT', 'Upload requires admitted GPU allocation and live CPU reader'); integer(offset, 'Upload offset'); integer(bytes, 'Upload bytes', 1); integer(sourceOffset, 'Upload source offset');
        invariant(!h.res.readOnlyTopology,'INVALID_INPUT','Host-admitted shared topology is immutable');
        invariant(offset <= h.res.bytes - bytes && sourceOffset <= r.value.byteLength - bytes, 'INVALID_INPUT', 'Upload range exceeds an exact owned allocation');
        invariant(offset <= h.res.uploadedPrefix, 'INVALID_INPUT', 'First upload coverage must be contiguous from the start of the allocation');
        consume(o); takeUpload(o, bytes); h.res.lastUsed = true;
        try{sync(backend.writeGpu(h.res.value, offset, r.value.subarray(sourceOffset, sourceOffset + bytes)), 'GPU upload');}catch(error){if(error?.code==='COMMITTED_UNCERTAIN')h.res.unsafeSubmission=true;throw error;} h.res.uploadedPrefix = Math.max(h.res.uploadedPrefix, offset + bytes); counters.uploadedBytes += bytes;
      },
      async prepare(requestKey, task, { signal } = {}) {
        owner(api); invariant(typeof task === 'function', 'INVALID_INPUT', 'Preparation task required'); const request = requests.get(requestKey);
        invariant(request && request.owner === o && request === o.request, 'STALE_REQUEST', 'Request is not this exact current provider generation');
        invariant(!signal || typeof signal.addEventListener === 'function', 'INVALID_INPUT', 'Invalid cancellation signal');
        invariant(!signal || !signal.aborted, 'CANCELLED', 'Preparation already cancelled');
        invariant(o.jobs < caps.maxJobs && jobs.size < hostLimits.maxJobs, 'JOB_QUOTA', 'Concurrent pending/running job quota exhausted');
        const controller = new AbortController(), job = { owner: o, request, controller, handles: new Set(), readers: new Set(), live:true };
        jobs.add(job); o.jobs++; counters.jobsAdmitted++; counters.jobsPeak = Math.max(counters.jobsPeak, jobs.size);
        const cancel = () => controller.abort(); if (signal) signal.addEventListener('abort', cancel, { once: true });
        let success = false;
        try {
          jobCheck(job); consume(o);
          const scope = Object.freeze({ signal: controller.signal, check: () => jobCheck(job), consumeWork: units => { jobCheck(job); consume(o, units); }, allocateCpu: (bytes, options) => allocate(o, 'cpu', bytes, options, job), allocateGpu: (kind, bytes, options) => allocate(o, kind, bytes, options, job), adoptShared:cap=>adoptTopology(job,cap), borrowCpu: key => { jobCheck(job); return borrow(o, key); }, upload: (...args) => { jobCheck(job); return api.upload(...args); }, release: key => { jobCheck(job); drop(lookup(key, o)); }, async yield() { jobCheck(job); invariant(scheduleYield, 'SCHEDULER_REQUIRED', 'Host must admit a bounded scheduler before preparation yields'); await scheduleYield(Object.freeze({ signal: controller.signal })); jobCheck(job); } });
          const result = await task(scope); jobCheck(job);
          invariant(!contextLost, 'CONTEXT_LOST', 'Lost graphics context cannot produce a complete visual lease');
          exactKeys(result, ['resources', 'readiness', 'coverageProof'], 'Prepared result'); exactKeys(result.readiness, READY, 'Readiness');
          invariant(typeof result.coverageProof === 'string' && /^[0-9a-f]{64}$/.test(result.coverageProof), 'NOT_READY', 'Exact immutable coverage proof reference required');
          invariant(READY.every(key => result.readiness[key] === true), 'NOT_READY', 'Visual, support, identity and conservative bounds must all be ready');
          invariant(Array.isArray(result.resources) && result.resources.length > 0 && new Set(result.resources).size === result.resources.length, 'NOT_READY', 'Complete unique output resources required');
          const outputKeys=result.resources.slice(), ownedReady=Object.freeze({...result.readiness}), coverageProof=result.coverageProof, outputSet=new Set(outputKeys);
          consume(o, outputKeys.length);
          const descriptions = outputKeys.map(key => { const h = lookup(key, o); requireSafe(h.res);invariant(job.handles.has(key) && !h.res.invalidGpu && (h.res.kind === 'cpu' || h.res.uploadedPrefix === h.res.bytes), 'NOT_READY', 'Preparation output must be exact owned, fully uploaded job resources'); return Object.freeze({ kind: h.res.kind, bytes: h.res.bytes, memoryClass: h.res.memoryClass, layout: h.res.layout }); });
          const valid = sync(verifyPrepared(Object.freeze({ contextDigest: request.contextDigest, tier: request.tier, readiness: ownedReady, resources: Object.freeze(descriptions), coverageProof })), 'Prepared proof verification');
          invariant(valid === true, 'NOT_READY', 'Host coverage/support/identity verifier refused'); jobCheck(job);
          for (const key of job.handles) if (!outputSet.has(key)) { const h = handles.get(key); if (h.active) drop(h); }
          const p = { owner: o, request, contextDigest: request.contextDigest, tier: request.tier, keys: outputKeys, readiness: ownedReady, released: false, active: false };
          const pkey = Object.freeze({}); prepared.set(pkey, p); preparedSet.add(p); success = true; return pkey;
        } catch (error) { if (error.code === 'CANCELLED') counters.cancellationRefusals++; throw error; }
        finally {
          if (signal) signal.removeEventListener('abort', cancel);
          for(const r of Array.from(job.readers))if(r.active)closeReader(r); job.live=false;
          if (!success) for (const key of job.handles) { const h = handles.get(key); if (h.active) drop(h); }
          for(const key of job.handles){const h=handles.get(key);if(h.job===job)h.job=null;}
          jobs.delete(job); o.jobs--;forgetDisposedOwner(o);
        }
      },
      dispose() {
        owner(api, true); if (o.disposed) return;
        invariant(!current || !current.members.some(p=>p.owner===o), 'OWNER_IN_USE', 'Current support must be released by its host owner'); o.disposed = true; cancelOwnerJobs(o);
        if(o.request)for(const cap of Array.from(o.request.topology))closeTopology(cap);
        for (const p of Array.from(preparedSet)) if (p.owner === o) releasePrepared(p);
        for (const h of Array.from(o.leases)) if (h.active) drop(h);
        forgetDisposedOwner(o);
      },
      inspect: () => Object.freeze({ category: o.category, held: Object.freeze({ ...o.usage }), peak: Object.freeze({ ...o.peaks }), jobs: o.jobs, disposed: o.disposed })
    });
    providers.set(api, o); admittedServices.set(api,o); ownerSet.add(o); return api;
  }
  const host = Object.freeze({
    createProvider: budgets => createProvider(budgets),
    createServiceOwner() { liveHost(); if (!serviceApi) serviceApi = createProvider({ maxCpuBytes: SERVICE_CPU_LIMIT, maxGpuBufferBytes: SERVICE_GPU_LIMIT, maxGpuTextureBytes: SERVICE_GPU_LIMIT, maxTransientCpuBytes: SERVICE_CPU_LIMIT, maxTransientGpuBytes: SERVICE_GPU_LIMIT, maxJobs: hostLimits.maxJobs, maxStageRadiusM: 1, maxUploadBytesPerFrame: hostLimits.maxUploadBytesPerFrame, maxPrepareOpsPerSlice: hostLimits.maxPrepareOpsPerSlice }, 'service'); return serviceApi; },
    // Root-only framebuffer/AA/depth resources share the exact host aggregate.
    // These are neither service metadata nor an imported provider capability.
    createHostTargetOwner() { liveHost(); if (!hostTargetApi) hostTargetApi = createProvider({ maxCpuBytes: hostLimits.cpuResidentBytes, maxGpuBufferBytes: hostLimits.gpuBufferResidentBytes, maxGpuTextureBytes: hostLimits.gpuTextureResidentBytes, maxTransientCpuBytes: hostLimits.cpuTransientBytes, maxTransientGpuBytes: hostLimits.gpuTransientBytes, maxJobs: hostLimits.maxJobs, maxStageRadiusM: 1, maxUploadBytesPerFrame: hostLimits.maxUploadBytesPerFrame, maxPrepareOpsPerSlice: hostLimits.maxPrepareOpsPerSlice }, 'host-target'); invariant(!owner(hostTargetApi, true).disposed, 'DISPOSED', 'Root target owner is disposed'); return hostTargetApi; },
    createCredits(api, { uploadQuantum = 1 } = {}) { integer(uploadQuantum, 'Upload credit quantum', 1); return credits(owner(api), uploadQuantum); },
    allocateGpuWithFactory(api,kind,bytes,physicalFactory,options){const o=owner(api);invariant(typeof physicalFactory==='function'&&physicalFactory.constructor.name!=='AsyncFunction','BACKEND_CONTRACT','Root physical creation must be statically synchronous');invariant(kind==='gpu-buffer'||kind==='gpu-texture','INVALID_INPUT','Root GPU creation kind differs');return allocate(o,kind,bytes,options,null,physicalFactory);},
    withGpuUse:gpuUse,
    uploadGpuTexture(key,byteLength,callback){integer(byteLength,'Texture upload bytes',1);const h=lookup(key,null,true);invariant(byteLength<=h.res.bytes,'INVALID_INPUT','Texture upload exceeds owned physical allocation');return gpuUse([key],callback,byteLength);},
    uploadGpuTextureBounded(key,wantedBytes,quantum,callback){liveHost();invariant(!contextLost,'CONTEXT_LOST','Host context lost');integer(wantedBytes,'Wanted texture upload bytes',1);integer(quantum,'Texture upload quantum',1);invariant(typeof callback==='function'&&callback.constructor.name!=='AsyncFunction','BACKEND_CONTRACT','Host texture callback must be statically synchronous');const h=lookup(key,null,true),res=h.res,o=h.owner;invariant(res.kind==='gpu-texture'&&!res.invalidGpu,'NOT_READY','Exact usable texture lease required');invariant(!o.disposed,'DISPOSED','Texture owner disposed');invariant(wantedBytes<=res.bytes,'INVALID_INPUT','Wanted upload exceeds exact texture allocation');if(work>=hostLimits.maxPrepareOpsPerSlice||o.work>=o.limits.maxPrepareOpsPerSlice)return 0;const granted=Math.floor(Math.min(wantedBytes,hostLimits.maxUploadBytesPerFrame-uploads,o.limits.maxUploadBytesPerFrame-o.uploads)/quantum)*quantum;if(!granted)return 0;gpuUse([key],records=>callback(records,granted),granted);return granted;},
    inspectResource(key){const h=handles.get(key);invariant(h&&h.generation===h.res.generation,'STALE_RELEASE','Unknown or foreign resource observation token');const res=h.res,physicallyRetained=!res.destroyed,usable=h.active&&physicallyRetained&&gpuUsable(res);return Object.freeze({kind:res.kind,bytes:res.bytes,memoryClass:res.memoryClass,layout:res.layout,leaseActive:h.active,physicallyRetained,physicalHeld:physicallyRetained,usable,lifecycle:res.destroyed?'DISPOSED':res.retiring?'RETIRING':'LIVE',readers:res.readers.size,fencePending:!!res.fence,unsafeSubmission:!!res.unsafeSubmission,contextUsable:physicallyRetained&&gpuUsable(res)});},
    share(sourceKey, destinationApi, phase = 'neighbor') { liveHost(); invariant(PHASES.has(phase), 'INVALID_INPUT', 'Unknown lifetime phase'); const source = lookup(sourceKey, null, true), destination = owner(destinationApi);requireSafe(source.res); invariant(source.res.kind === 'cpu' || (!contextLost && !source.res.invalidGpu), 'CONTEXT_LOST', 'A lost GPU identity cannot be shared as usable'); return token(source.res, destination, phase); },
    beginFrame() { liveHost(); frame++; uploads = 0; for (const o of ownerSet) o.uploads = 0; },
    beginSlice() { slice++; work = 0; for (const o of ownerSet) o.work = 0; },
    beginRequest(api, input) {
      const o = owner(api); exactKeys(input, ['contextDigest', 'tier'], 'Preparation request'); const { contextDigest, tier } = input;
      invariant(typeof contextDigest === 'string' && /^[0-9a-f]{64}$/.test(contextDigest) && TIERS.has(tier), 'INVALID_INPUT', 'Exact semantic context and representation required'); cancelOwnerJobs(o);if(o.request)for(const cap of Array.from(o.request.topology))closeTopology(cap);
      const request = { owner: o, contextDigest, tier, topology:new Set(), generation: nextGeneration() }, key = Object.freeze({}); requests.set(key, request); o.request = request; return key;
    },
    admitSharedTopology(requestKey, sourcePreparedKey, index){liveHost();const request=requests.get(requestKey);invariant(request&&request===request.owner.request&&!request.owner.disposed,'STALE_REQUEST','Exact current host request required');const sourcePrepared=getPrepared(sourcePreparedKey);integer(index,'Shared topology index');invariant(index<sourcePrepared.keys.length,'INVALID_INPUT','Shared topology index exceeds exact source closure');const source=lookup(sourcePrepared.keys[index],sourcePrepared.owner,true);requireSafe(source.res);invariant(source.res.kind==='gpu-buffer'&&source.res.layout==='indices-u16'&&source.res.uploadedPrefix===source.res.bytes&&!source.res.invalidGpu&&!contextLost,'NOT_READY','Only complete immutable native topology may be shared');consume(request.owner);const held=token(source.res,request.owner,'neighbor',true);source.res.readOnlyTopology=true;const cap={request,key:held,closed:false},key=Object.freeze({});request.topology.add(cap);topologyCapabilities.set(key,cap);return key;},
    releaseSharedTopology(key){const cap=topologyCapabilities.get(key);invariant(cap&&!cap.closed,'STALE_RELEASE','Shared topology capability already closed');closeTopology(cap);},
    activate(preparedKey, expectedCurrent = null) {
      liveHost();invariant(!contextLost,'CONTEXT_LOST','Lost context cannot activate visual coverage');
      invariant((!current&&expectedCurrent===null)||(current&&current.members.length===1&&prepared.get(expectedCurrent)===current.members[0]),'STALE_CURRENT','Singleton active support changed before commit');
      const p=prepared.get(preparedKey);invariant(p&&!p.released&&!p.active,'STALE_REQUEST','Singleton candidate is released or already active');activateMembers([preparedKey],current);
      return preparedKey;
    },
    activateBundle(keys,expectedCurrentBundle=null){const expected=expectedCurrentBundle===null?null:bundles.get(expectedCurrentBundle);invariant(expectedCurrentBundle===null||(expected&&!expected.released),'STALE_CURRENT','Expected bundle is unknown or released');return activateMembers(keys,expected);},
    releaseBundle(key){releaseBundle(bundles.get(key));},
    inspectBundle(key){const b=bundles.get(key);invariant(b&&!b.released,'STALE_RELEASE','Unknown or released bundle');return Object.freeze({active:b===current,members:Object.freeze(b.memberKeys.map(token=>host.inspectPrepared(token)))});},
    releasePrepared(preparedKey) { const p = prepared.get(preparedKey); invariant(p, 'STALE_RELEASE', 'Unknown prepared token'); releasePrepared(p); },
    inspectPrepared(preparedKey) { const p = getPrepared(preparedKey); return Object.freeze({ contextDigest: p.contextDigest, tier: p.tier, active: !!current&&current.members.includes(p), readiness: Object.freeze({...p.readiness,visualCoverageReady:p.readiness.visualCoverageReady&&p.keys.every(key=>gpuUsable(handles.get(key).res))}), resources: Object.freeze(p.keys.map(key => { const h = lookup(key, p.owner, true); return Object.freeze({ kind: h.res.kind, bytes: h.res.bytes, layout: h.res.layout, memoryClass: h.res.memoryClass, usable: gpuUsable(h.res) }); })) }); },
    borrowPreparedCpu(preparedKey, index) { liveHost(); const p = getPrepared(preparedKey); integer(index, 'Prepared resource index'); invariant(index < p.keys.length, 'INVALID_INPUT', 'Prepared resource index exceeds exact closure'); return borrow(p.owner, p.keys[index], true); },
    // Fixed root-only prospective read/probe. It uses the same exact GPU
    // readers, shared work counters, fence retention and synchronous contract.
    withPreparedGpu(preparedKey, callback) { liveHost(); const p=getPrepared(preparedKey); const gpu=p.keys.filter(key=>lookup(key,p.owner,true).res.kind!=='cpu'); invariant(gpu.length,'NOT_READY','Prepared GPU closure is empty'); return gpuUse(gpu,callback); },
    submitPrepared(preparedKey, pass) {
      liveHost(); invariant(!contextLost, 'CONTEXT_LOST', 'Renderer context lost'); const p = getPrepared(preparedKey, true); invariant(typeof backend.submit === 'function', 'BACKEND_CONTRACT', 'Host backend has no admitted positions submission slot');
      const gpu=p.keys.filter(key=>lookup(key,p.owner,true).res.kind!=='cpu');invariant(gpu.length,'NOT_READY','Active GPU resources are incomplete');return gpuUse(gpu,resources=>backend.submit(resources,pass));
    },
    markSubmitted(preparedKey) { liveHost(); invariant(!contextLost, 'CONTEXT_LOST', 'Renderer context lost'); const p = prepared.get(preparedKey); invariant(current&&current.members.includes(p) && !p.released, 'NOT_READY', 'Only actual active host preparation may submit'); for (const key of p.keys) { const h = lookup(key, p.owner, true); requireSafe(h.res);invariant(!h.res.invalidGpu, 'NOT_READY', 'Active GPU resource invalid'); if (h.res.kind !== 'cpu') h.res.lastUsed = true; } },
    loseContext() {
      // Disposal retires authority but authentic loss must still settle retained GPU bytes.
      if(backend.verifyContextLoss)sync(backend.verifyContextLoss(),'Actual backend loss verification'); contextLost = true; for (const job of jobs) job.controller.abort();
      // Readiness invalidates before backend callbacks, including callback faults.
      for (const res of resources) if (res.kind !== 'cpu') { res.invalidGpu = true; res.fenceFault = null; }
      try { sync(backend.loseContext(), 'Backend context loss'); }
      finally { for (const res of Array.from(resources)) if (res.kind !== 'cpu') tryDestroy(res); }
    },
    restoreContext() { liveHost(); invariant(contextLost, 'INVALID_INPUT', 'Context is not lost'); sync(backend.restoreContext(), 'Backend context restoration'); contextLost = false; },
    drain(maxVisits = hostLimits.maxPrepareOpsPerSlice) {
      integer(maxVisits, 'Retirement visits', 1); invariant(maxVisits <= hostLimits.maxPrepareOpsPerSlice, 'WORK_QUOTA', 'Retirement polling slice exceeds host bound');
      if (!drainIterator) drainIterator = resources.values();
      for (let visit = 0; visit < maxVisits; visit++) {
        if (work >= hostLimits.maxPrepareOpsPerSlice) break;
        const item = drainIterator.next(); if (item.done) { drainIterator = null; break; } const res = item.value;
        if (!maintenance(res)) break;
        tryDestroy(res, true);
      }
      return host.inspect();
    },
    dispose() {
      if (!disposed) { disposed = true;if(current)current.released=true; current = null; for (const job of jobs) job.controller.abort(); for (const p of Array.from(preparedSet)) releasePrepared(p); for (const o of ownerSet) { o.disposed = true;if(o.request)for(const cap of Array.from(o.request.topology))closeTopology(cap); for (const h of Array.from(o.leases)) if (h.active) drop(h);forgetDisposedOwner(o); } }
      return host.drain();
    },
    inspect() {
      const active = current && !current.released ? { ...(current.members.length===1?{contextDigest:current.members[0].contextDigest,tier:current.members[0].tier}:{}),members:Object.freeze(current.members.map(p=>Object.freeze({contextDigest:p.contextDigest,tier:p.tier}))), terrainAndCollisionReady:current.members.every(p=>p.readiness.terrainAndCollisionReady), visualCoverageReady:!contextLost&&current.members.every(p=>p.keys.every(key=>gpuUsable(handles.get(key).res))) } : null;
      return Object.freeze({ held: Object.freeze({ ...usage }), peak: Object.freeze({ ...peaks }), physicalResources: resources.size, logicalLeases: logicalLeaseCount, cpuReaders: readerCount, gpuReaders:gpuReaderCount, retiringResources: retiringCount, jobs: jobs.size, phaseCounts: Object.freeze({ ...phaseCounts }), active, contextLost, disposed, currentFrameUploadBytes: uploads, currentSliceWork: work, counters: Object.freeze({ ...counters }), accounting: 'EXACT_OWNED_CPU_ARRAYBUFFER_LENGTHS_AND_DECLARED_MOCK_GPU_BYTES_ONLY', backendQualification: 'NOT_GPU', nativeHeap: 'UNMEASURED', wrappersAndEngine: 'UNMEASURED', driverPeak: 'UNMEASURED' });
    }
  });
  admittedHosts.add(host); return host;
}

const API = Object.freeze({ createHost, isProviderServices: api => { const o=admittedServices.get(api);return !!o&&o.category==='provider'&&!o.disposed; }, isHost: host => admittedHosts.has(host) });
if (typeof module === 'object' && module.exports) module.exports = API;
else globalThis.SphereBiomeNativeResources = API;
})();
