import {integerHash,splitCell} from './grass-stage.js';
export const SCATTER_MIN=-.5,SCATTER_SPAN=2;
export const SCATTER_GLSL=`const float scatterMin=${SCATTER_MIN.toFixed(1)},scatterSpan=${SCATTER_SPAN.toFixed(1)};`;
// CPU reference for geographic and sampling checks; no runtime root arrays.
export function clumpRoot(eastCell,northCell,blade,pitch){
 const e=splitCell(eastCell),n=splitCell(northCell);
 const cluster=integerHash(e.low^integerHash(n.low)^integerHash((e.high+713)>>>0)^integerHash(n.high));
 const seed=integerHash((cluster+Math.imul(blade,0x9e3779b9))>>>0);
 const offset=[integerHash((seed+1)>>>0)/4294967296,integerHash((seed+2)>>>0)/4294967296];
 return {seed,offset,position:[(eastCell+SCATTER_MIN+SCATTER_SPAN*offset[0])*pitch,(northCell+SCATTER_MIN+SCATTER_SPAN*offset[1])*pitch]};
}
export function pixelThreshold(x,y){return integerHash(((x>>>0)+Math.imul(y,0x9e3779b9))>>>0)/4294967296;}
