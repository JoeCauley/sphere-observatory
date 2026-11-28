import {placements} from './address.mjs';

export function factoryChair(id) {
  return {id, revision: 0, target: 'A', pose: {...placements.A}};
}

// A duplicate acknowledges the original transaction, alongside the latest chair.
// The client can receive either response first.
export function placeChair(previous, id, request) {
  const chair = previous?.chair ?? factoryChair(id);
  const {actionId, expected, target} = request ?? {};
  if (typeof actionId !== 'string' || !/^[a-zA-Z0-9_-]{1,96}$/.test(actionId) ||
      !Number.isSafeInteger(expected) || expected < 0 || !['A', 'B'].includes(target) ||
      Object.keys(request).some(k => !['actionId', 'target', 'expected'].includes(k))) {
    return {status: 400, body: {error: 'Use a valid action and a marked chair position.', chair}};
  }
  const receipts = previous?.receipts ?? [];
  const found = receipts.find(r => r.actionId === actionId);
  if (found) {
    if (found.target !== target || found.expected !== expected)
      return {status: 409, body: {error: 'This action ID belongs to another move.', chair}};
    return {status: 200, body: {duplicate: true, receipt: found, chair}};
  }
  if (chair.revision !== expected || target === chair.target)
    return {status: 409, body: {error: 'The current placement has changed.', chair}};
  const revision = expected + 1;
  const next = {id, revision, target, pose: {...placements[target]}};
  const receipt = {actionId, expected, target, revision};
  return {status: 200, body: {chair: next, receipt}, write: {schema: 1, chair: next, receipts: [...receipts, receipt]}};
}

export function currentChair(current, incoming) {
  return incoming && incoming.id === current.id && incoming.revision >= current.revision ? incoming : current;
}
