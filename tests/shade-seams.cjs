const assert=require('node:assert/strict'),M=require('../math.js');
for(const f of ['collection','biomes','world-palette','world','field-sites'])require('../'+f+'.js');
const C=SphereCollection,E=SphereEdges,B=SphereShadeEdges;let lodVertices=0,joins=0,corners=0,maxGap=0,maxFaceError=0;
const vertices=m=>Array.from({length:m.count},(_,i)=>[0,1,2].map(k=>m.canonicalOrigin[k]+m.vertices[i*11+k]));
for(const shape of ['disk','square','cap','trimmed']){
 const s={...M.defaultState(),collection:true,shadeShape:shape,era:'before'},p=C.plates(s).find(p=>p.id===4),r=M.length(p.center)*s.radius,cornerProfiles=new Map();
 for(const c of B.curves(p))for(const fraction of [0,.5,1]){
  const t=c.lo+(c.hi-c.lo)*fraction;s.position=E.plateVector(E.canonicalPoint(s,p,...c.at(t)),p);
  const coarse=E.plan(s,320,{coarse:true}),fine=E.plan(s,320,{fine:true}),ordered=[...coarse].filter(([k])=>k.includes('"'+c.id+'"')).sort((a,b)=>a[1].priority-b[1].priority).slice(0,3).map(([key,build])=>{
   const a=build(),b=fine.get(key.replace(/:far$/,':near'))();const set=new Set(Array.from({length:b.count},(_,i)=>[...b.vertices.subarray(i*11,i*11+3)].join(',')));
   for(let i=0;i<a.count;i++){assert(set.has([...a.vertices.subarray(i*11,i*11+3)].join(',')),'LOD replacement preserves every envelope vertex');lodVertices++;}
   const points=vertices(a);for(const q of points){const height=shape==='cap'||shape==='trimmed'?M.length(q)-r:q[1]-r;if(Math.abs(height)<.000001||Math.abs(height-.18)<.000001)maxFaceError=Math.max(maxFaceError,Math.min(Math.abs(height),Math.abs(height-.18)));}
   return {mesh:a,points};
  });
  if(fraction!==.5&&c.id!=='perimeter'){const uv=c.at(t),key=uv.map(v=>v.toFixed(10)).join(','),point=E.canonicalPoint(s,p,...uv),points=ordered.flatMap(m=>m.points),profile=[];
   for(const depth of [0,.02,.055,.125,.16,.18]){const expected=shape==='cap'||shape==='trimmed'?M.mul(point,(r+depth)/r):M.add(point,[0,depth,0]),q=points.reduce((best,q)=>M.length(M.sub(q,expected))<M.length(M.sub(best,expected))?q:best,points[0]);assert(M.length(M.sub(q,expected))<.0000002,'Corner profile closes flush against the adjoining edge');profile.push(q);}
   if(cornerProfiles.has(key)){const previous=cornerProfiles.get(key);for(let i=0;i<profile.length;i++){const gap=M.length(M.sub(profile[i],previous[i]));assert(gap<.0000002);maxGap=Math.max(maxGap,gap);corners++;}}else cornerProfiles.set(key,profile);
  }
  for(const a of ordered)for(const b of ordered){if(a===b)continue;const end=a.mesh.shadeRange[1],start=b.mesh.shadeRange[0],wrap=c.id==='perimeter'&&end===c.hi&&start===c.lo;if(end!==start&&!wrap)continue;
   const point=E.canonicalPoint(s,p,...c.at(wrap?c.lo:end));
   // Top/bottom endpoints are anchored on the same continuous analytic faces.
   for(const depth of [0,.18]){const expected=shape==='cap'||shape==='trimmed'?M.mul(point,(r+depth)/r):M.add(point,[0,depth,0]),nearest=list=>list.reduce((best,q)=>M.length(M.sub(q,expected))<M.length(M.sub(best,expected))?q:best,list[0]),pa=nearest(a.points),pb=nearest(b.points);const gap=M.length(M.sub(pa,pb));assert(gap<.0000002,'Shared curved endpoint differs by more than 0.2 mm: '+JSON.stringify({shape,c:c.id,gap,end,start}));maxGap=Math.max(maxGap,gap);joins++;}
  }
 }
}
assert(joins>20&&corners>=48);assert(maxFaceError<.0000002);console.log(JSON.stringify({status:'PASS',lodVertices,joins,corners,maxGapMm:maxGap*1e6,maxFaceErrorMm:maxFaceError*1e6}));
