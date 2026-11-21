/* Sphere atlas: the whole inner surface, divided into plots.
 *
 * Every point on the surface belongs to exactly one of:
 *   a plot              - one biome's ground: installed, blank, or (only where declared) under construction;
 *   a border            - the strip along every plot edge;
 *   a transport trunk   - Sphere-wide lines: the two edges of the habitat waist and six meridians;
 *   a polar megalopolis - everything beyond the last row of plots.
 * Wounds and the breach stay Main's own; plots they cut are not offered for install.
 *
 * Plots are rows of latitude in the world frame, 6.667 degrees tall, aligned to
 * Main's geography: the habitat waist (20 degrees either side of the equator) is
 * six rows, two under each shade track. Each row is cut into near-square plots,
 * 54 at the equator, fewer toward the poles. 890 plots in all.
 *
 * Status, after the Builder Stewardship Charter's convention: the plot grid, border
 * and trunk widths, trunk routes and the polar boundary are PROPOSED, not established
 * lore. Nothing here decides what a plot contains; that is declared, never generated.
 *
 * Pure arithmetic, no state: the same functions run here and, as GLSL, in the
 * surface shader (biome-surface.js). Keep the two in step.
 */
(function (root) {
  'use strict';

  const ROW = (20 / 3) * Math.PI / 180, HALF_ROWS = 11, ROWS = HALF_ROWS * 2, LIMIT = HALF_ROWS * ROW;
  const EQUATOR_COLUMNS = 54, MIN_COLUMNS = 6, WAIST_FIRST = 8, WAIST_LAST = 13;
  const BORDER_KM = 20000, TRUNK_KM = 60000, TRUNK_MERIDIANS = 6;
  const TRACKS = ['Verdant track', 'Opaline track', 'Amber track'];

  const columns = row => Math.max(MIN_COLUMNS, Math.round(EQUATOR_COLUMNS * Math.cos((row + 0.5) * ROW - LIMIT)));
  const offsets = []; let TOTAL = 0;
  for (let row = 0; row < ROWS; row++) { offsets.push(TOTAL); TOTAL += columns(row); }

  function make(row, col) {
    const n = columns(row), waist = row >= WAIST_FIRST && row <= WAIST_LAST, latitude = (row + 0.5) * ROW - LIMIT;
    return { index: offsets[row] + col, id: 'r' + row + 'c' + col, row, col, columns: n, latitude,
      longitude: (col + 0.5) / n * 2 * Math.PI - Math.PI, halfHeight: ROW / 2, halfWidth: Math.PI / n * Math.cos(latitude),
      zone: waist ? 'waist' : 'works', track: waist ? TRACKS[Math.floor((row - WAIST_FIRST) / 2)] : null };
  }
  function plot(index) {
    if (!Number.isInteger(index) || index < 0 || index >= TOTAL) return null;
    let row = ROWS - 1; while (offsets[row] > index) row--;
    return make(row, index - offsets[row]);
  }
  function plotAt(latitude, longitude) {
    if (Math.abs(latitude) >= LIMIT) return null;   // polar megalopolis
    const row = Math.min(ROWS - 1, Math.floor((latitude + LIMIT) / ROW)), n = columns(row);
    return make(row, Math.min(n - 1, Math.max(0, Math.floor((longitude + Math.PI) / (2 * Math.PI) * n))));
  }
  // Local coordinates run from -1 to +1 across the index cell. Old places fill their cell.
  function contains(item, cell, latitude, longitude) {
    if (!cell || item.plot!==cell.index) return false;
    const b=item.footprint;
    if (!b) return true;
    const dl=Math.atan2(Math.sin(longitude-cell.longitude),Math.cos(longitude-cell.longitude));
    const x=dl*cell.columns/(Math.PI*b.east), y=(latitude-cell.latitude)/(cell.halfHeight*b.north);
    return b.shape==='ellipse' ? x*x+y*y<=1 : Math.max(Math.abs(x),Math.abs(y))<=1;
  }
  function regionAt(items, latitude, longitude) {
    const cell=plotAt(latitude,longitude);
    return cell ? items.find(item=>!item.edge && contains(item,cell,latitude,longitude))??null : null;
  }
  function byId(id) {
    const m = /^r(\d+)c(\d+)$/.exec(String(id));
    if (!m) return null;
    const row = +m[1], col = +m[2];
    return row < ROWS && col < columns(row) ? make(row, col) : null;
  }

  // A Border site belongs to an edge, so it never consumes either adjacent plot.
  function northEdge(id) {
    const near=byId(id);
    if(!near || near.row===ROWS-1)return null;
    const latitude=near.latitude+near.halfHeight, half=Math.PI/near.columns;
    const step=2*Math.PI/TRUNK_MERIDIANS, meridian=Math.round(near.longitude/step)*step;
    const onTrunk=Math.abs(meridian-near.longitude)<half-1e-10;
    const longitude=onTrunk?meridian:near.longitude;
    const far=plotAt(latitude+1e-8,longitude);
    return {id:'north/'+near.id+'/'+far.id,near:near.id,far:far.id,latitude,longitude,onTrunk};
  }

  const api = Object.freeze({ ROW, ROWS, LIMIT, TOTAL, EQUATOR_COLUMNS, MIN_COLUMNS, WAIST_FIRST, WAIST_LAST, BORDER_KM, TRUNK_KM, TRUNK_MERIDIANS, TRACKS, columns, plot, plotAt, contains, regionAt, byId, northEdge, waterwayAt:(q,state)=>root.SphereNeighbourhood?.featureAt(q,state)??null });
  root.SphereAtlas = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
