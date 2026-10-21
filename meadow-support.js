/* Shared fixed-chart support for the bounded Open meadow study.
 * Returned points and normals come from the rendered/collision owner, not a
 * parallel semantic-height approximation. Distances and chart extents here
 * are metres; the Observatory's world vectors and support heights are km.
 */
(function(root){
'use strict';
const M=root.SphereMath,E=root.SphereMeadowEcology;
if(!M||!E)throw Error('Math and Meadow ecology must load before Meadow support');
const REVISION=1;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),length=v=>Math.hypot(...v);
function query(state,xMetres,zMetres,options={}){
 const chartDirection=E.chartDirection(state,xMetres,zMetres),override=options.surfaceSupport;
 let support=typeof override==='function'?override(state,xMetres,zMetres,chartDirection):null;
 if(!support)support=root.SphereGround?.surfaceSupport?.(state,chartDirection)||null;
 if(!support)support=root.SphereWatershed?.surfaceSupport?.(chartDirection,state)||null;
 // The fixed Open meadow chart lies in the neighbourhood layer, whose land
 // is the analytic inner shell itself (its rivers and ground colours are
 // material overlays, not displaced/collided terrain). This is the exact
 // SphereMath shell intersection used by both the renderer and flight trace.
 if(!support){
  const coverage=E.coverageAt(chartDirection,state),missing=root.SphereCollection?.missing?.(chartDirection,state)||M.inBreach(chartDirection,state);
  if(coverage.inside&&!missing){const point=mul(chartDirection,Number(state.radius));support={point,normal:mul(chartDirection,-1),direction:chartDirection,heightKm:0,triangleId:'analytic-inner-shell',source:'analytic-inner-shell-collision'};}
 }
 if(!support)return null;
 return {...support,point:support.point.slice(),normal:support.normal.slice(),direction:(support.direction||M.norm(support.point)).slice(),chart:[xMetres,zMetres],chartDirection};
}
function camera(state,position=state?.position,options={}){
 if(!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))return null;
 const chart=E.chartCoordinates(state,M.norm(position));if(Math.abs(chart[0])>=E.DOMAIN.half||Math.abs(chart[1])>=E.DOMAIN.half)return null;
 const support=query(state,chart[0],chart[1],options);if(!support)return null;
 support.cameraHeightKm=dot(sub(position,support.point),support.normal);support.cameraChart=chart;return support;
}
function triangleArea(a,b,c){return length(M.cross(sub(b,a),sub(c,a)))*.5*1e6;}
function measureCell(state,cell,{steps=16,cameraPoint=null,surfaceSupport}={}){
 const x0=-E.DOMAIN.half+cell.x*cell.size,z0=-E.DOMAIN.half+cell.z*cell.size,step=cell.size/steps,nodes=Array.from({length:steps+1},()=>Array(steps+1));
 let supportQueries=0;
 for(let z=0;z<=steps;z++)for(let x=0;x<=steps;x++){nodes[z][x]=query(state,x0+x*step,z0+z*step,{surfaceSupport});supportQueries++;}
 let surfaceAreaM2=0,eligibleAreaM2=0,eligibleArea0to5M2=0,eligibleArea5to15M2=0,validQuads=0;
 for(let z=0;z<steps;z++)for(let x=0;x<steps;x++){
  const a=nodes[z][x],b=nodes[z][x+1],c=nodes[z+1][x+1],d=nodes[z+1][x];if(!a||!b||!c||!d)continue;
  const area=triangleArea(a.point,b.point,c.point)+triangleArea(a.point,c.point,d.point);surfaceAreaM2+=area;validQuads++;
  const cx=x0+(x+.5)*step,cz=z0+(z+.5)*step,centre=query(state,cx,cz,{surfaceSupport});supportQueries++;if(!centre)continue;
  const field=root.SphereGeography?.query(centre.direction,{state,representation:'walking'}),ecology=field?.ecology;if(!ecology?.eligibleArea||!(ecology.grassDensityBladesPerM2>0))continue;
  eligibleAreaM2+=area;
  if(cameraPoint){const distance=length(sub(centre.point,cameraPoint))*1000;if(distance<=5)eligibleArea0to5M2+=area;else if(distance<=15)eligibleArea5to15M2+=area;}
 }
 return {surfaceAreaM2,eligibleAreaM2,eligibleArea0to5M2,eligibleArea5to15M2,validQuads,supportQueries,steps};
}
const api={REVISION,query,camera,triangleArea,measureCell};
root.SphereMeadowSupport=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
