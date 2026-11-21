import {circuits,runCircuit} from '../tests/support/surface-circuits.mjs';
import {along} from '../surface-passages.js';

// The unit is a directed change of surface owner. Reversing a passage can
// change the outlet, support and first-frame work, so direction is retained.
export function walkPlan(state,items,env,configuration){
  const rollSeeds=[0x5eefa113,713,20261120],pairs=new Map(),laps=[];
  for(const seed of rollSeeds){
    for(const route of circuits(state,items,env,seed)){
      const result=runCircuit(route,state,items,env);
      laps.push({seed,label:route.label,tunnels:result.tunnel,closureM:result.closureM,inclinationDeg:result.inclinationDeg});
      for(const l of route.legs){
        if(l.kind!=='tunnel')continue;
        const from=l.gate.near.id,to=l.gate.far.id,key=from+'--'+to;
        if(pairs.has(key)){pairs.get(key).count++;continue;}
        const point=offset=>along(route.circle.origin,route.circle.forward,l.start+offset/state.radius/1000);
        pairs.set(key,{key,from,to,count:1,seed,route:route.label,before:point(-2),after:point(2),gate:l.gate,installation:l.installation});
      }
    }
  }
  const all=[...pairs.values()].sort((a,b)=>a.key.localeCompare(b.key));
  const tags=r=>['depart '+r.from,'arrive '+r.to,...(r.installation?['service door']:[])];
  const required=new Set(all.flatMap(tags)),selection=[];
  while(required.size){
    const gain=r=>tags(r).reduce((n,t)=>n+Number(required.has(t)),0);
    const best=all.toSorted((a,b)=>gain(b)-gain(a)||a.count-b.count||a.key.localeCompare(b.key))[0];
    if(!gain(best))throw Error('Uncovered walking endpoint');
    selection.push(best);tags(best).forEach(t=>required.delete(t));
  }
  return {configuration,worldSeed:state.seed,circuitSeeds:rollSeeds,laps,
    pairs:all.map(({key,count})=>({key,count})),selection};
}
