import {applyMill, freshMill} from './rolling-mill.mjs';

// Absolute simulation timestamps merge overlapping observations. A retried command
// is identified before revision checks; conflicting material edits never merge.
export function transact(state, request, address) {
  const {atMs} = request;
  if (!Number.isSafeInteger(atMs) || atMs < 0 || atMs > 1e15) throw Error('Invalid simulation time');
  if (request.verb === 'clock') {
    if (atMs <= state.atMs || !Object.keys(state.machines).length) return {state};
    return {state:{...state, atMs}};
  }
  const at = Math.max(atMs, state.atMs);
  const result = applyMill(state.machines[address] ?? freshMill(), address, at, request);
  if (result.duplicate || result.rejected) return {state, duplicate:!!result.duplicate, rejected:result.rejected};
  return {state:{...state, atMs:at, machines:{...state.machines, [address]:result.record}}};
}
