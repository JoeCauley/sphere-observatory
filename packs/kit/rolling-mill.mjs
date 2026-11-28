// Mill addresses and material records outlive any one renderer or pack release.
export const cycleMs = 45000;
export const baySlot = 'rolling-01';

export function millAddress(world, instance, hex) {
  return [world, instance, hex, baySlot].join('/');
}

export function freshMill() {
  return {revision:0, slabs:3, job:null, rack:[null,null], shipped:[], paused:false, receipts:[]};
}

// A job keeps the amount left at its last start/pause. Looking never mutates a record.
export function remainingMs(record, now) {
  const job = record.job;
  if (!job) return 0;
  return Math.max(0, job.left - (record.paused ? 0 : Math.max(0, now - job.since)));
}

export function millAt(record, now) {
  if (!record.job || remainingMs(record, now) > 0) return record;
  const rack = record.rack.slice();
  rack[record.job.slot] = record.job.id;
  return {...record, job:null, rack};
}

export function counts(record) {
  return [record.slabs, Number(!!record.job), record.rack.filter(Boolean).length, record.shipped.length];
}

export function refusal(record, verb) {
  if (verb === 'pause' || verb === 'resume') return '';
  if (record.paused) return 'Machinery is paused.';
  if (verb === 'dispatch') return record.rack.some(Boolean) ? '' : 'The rack is empty.';
  if (record.job) return 'The mill is running.';
  if (!record.slabs) return 'The slab stack is empty.';
  if (!record.rack.includes(null)) return 'The rack is full. Dispatch a coil.';
  return '';
}

export function applyMill(stored, address, now, {verb, id, expected}) {
  const record = millAt(stored, now);
  if (!['feed','dispatch','pause','resume'].includes(verb) || typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(id) ||
      !Number.isSafeInteger(expected) || expected < 0) throw Error('Invalid mill command');
  const receipt = record.receipts.find(row => row.id === id);
  if (receipt) {
    if (receipt.verb !== verb) throw Error('Command ID already used for another action');
    return {record, duplicate:true};
  }
  if (expected !== record.revision) return {record, rejected:'The mill changed. Inspect it again.'};
  const reason = refusal(record, verb);
  if (reason) return {record, rejected:reason};
  const next = {...record};
  if (verb === 'feed') {
    const number = 4 - record.slabs;
    next.job = {id:address+'#'+number, slot:record.rack.indexOf(null), left:cycleMs, since:now};
    next.slabs--;
  } else if (verb === 'dispatch') {
    const slot = record.rack.findIndex(Boolean);
    next.shipped = [...record.shipped, record.rack[slot]];
    next.rack = record.rack.slice();
    next.rack[slot] = null;
  } else {
    const pause = verb === 'pause';
    if (pause === record.paused) return {record, duplicate:true};
    if (record.job) next.job = {...record.job, left:remainingMs(record, now), since:now};
    next.paused = pause;
  }
  if (verb === 'feed' || verb === 'dispatch') next.receipts = [...record.receipts,{id,verb}];
  next.revision++;
  return {record:next};
}

export const emptyProduction = () => ({schema:1, atMs:0, machines:{}});
export function lastDeadline(state) {
  let last = 0;
  for (const record of Object.values(state.machines)) {
    if (record.job && !record.paused) last = Math.max(last, record.job.since + record.job.left);
  }
  return last;
}
