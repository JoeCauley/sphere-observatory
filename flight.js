/* Continuous free-flight collision. World coordinates and distances remain doubles. */
(function(root){
'use strict';const M=root.SphereMath,C=root.SphereCollection,CLEARANCE=.002;
function sphereRoots(p,d,r){const length=M.length(p),b=M.dot(p,d),c=(length-r)*(length+r),disc=b*b-c;if(disc<0)return [];
 const q=-b-(b>=0?1:-1)*Math.sqrt(disc);return (q===0?[0]:[q,c/q]).sort((a,b)=>a-b);
}
function contact(s,p,d,distance,skipShell=false){let hit={distance:Infinity,normal:null,kind:''};
 // Test both crossings. A long step through an opening can still reach solid
 // ground on the opposite wall; endpoint clamping cannot detect that crossing.
 const inside=M.length(p)<=s.radius;
 if(!skipShell){if(Math.abs(s.radius-M.length(p))<CLEARANCE&&!M.inBreach(M.norm(p),s)&&M.dot(p,d)*(inside?1:-1)>0){hit={distance:0,normal:M.mul(M.norm(p),inside?-1:1),kind:'Inner surface'};}
 for(const side of [-1,1])for(const t of sphereRoots(p,d,s.radius+side*CLEARANCE)){if(t<0||t>distance||t>=hit.distance)continue;const q=M.norm(M.add(p,M.mul(d,t)));if(M.inBreach(q,s))continue;const normal=M.mul(q,side);if(M.dot(normal,d)<0)hit={distance:t,normal,kind:'Inner surface'};}}
 if(s.collection)for(const plate of C.plates(s)){const t=C.diskDistance(M.mul(p,1/s.radius),d,plate)*s.radius;if(t<distance&&t<hit.distance){const n=plate.shape==='cap'||plate.shape==='trimmed'?M.norm(M.add(p,M.mul(d,t))):plate.normal;hit={distance:Math.max(0,t-CLEARANCE/Math.max(.01,Math.abs(M.dot(n,d)))),normal:M.mul(n,M.dot(n,d)>0?-1:1),kind:'Shade'};}}
 if(s.geometryDetail&&root.SphereSites){const S=root.SphereSites;for(const mesh of S.geometry({...s,position:p})){const record={},local=mesh.local(p),dir=mesh.basis.map(b=>M.dot(d,b)),t=S.rayBVH(local,dir,mesh.bvh,Math.min(distance+1,hit.distance+1),record);if(!record.normal)continue;let n=mesh.basis.reduce((v,b,i)=>M.add(v,M.mul(b,record.normal[i])),[0,0,0]);if(M.dot(n,d)>0)n=M.mul(n,-1);const safe=Math.max(0,t-CLEARANCE/Math.max(.01,-M.dot(n,d)));if(safe<hit.distance&&safe<=distance)hit={distance:safe,normal:n,kind:mesh.name};}}
 return hit;
}
function move(s,d,distance){const p=s.position;if(!(distance>0))return {position:p.slice(),blocked:false};d=M.norm(d);
 if(s.layoutVersion!==2)return {position:M.add(p,M.mul(d,distance)),blocked:false};
 let position=p.slice(),blocked=false,kind='',curvedSlide=false;
 for(let iteration=0;iteration<3&&distance>.0000001;iteration++){
  const start=position,hit=contact(s,start,d,distance,curvedSlide);curvedSlide=false;if(hit.distance>distance){position=M.add(start,M.mul(d,distance));break;}
  blocked=true;kind=hit.kind;position=M.add(start,M.mul(d,Math.max(0,hit.distance-.000001)));
  if(kind==='Inner surface'&&Math.abs(s.radius-M.length(position))<CLEARANCE&&!M.inBreach(M.norm(position),s))position=M.mul(M.norm(position),s.radius+(M.length(start)<=s.radius?-CLEARANCE:CLEARANCE));
  // Retain the tangential part of a blocked movement, so descent becomes a
  // glide along the ground instead of trapping the camera against it.
  let slide=M.mul(M.sub(d,M.mul(hit.normal,Math.min(0,M.dot(d,hit.normal)))),distance-hit.distance);
  if(kind==='Inner surface'){const target=M.mul(M.norm(M.add(position,slide)),M.length(position));slide=M.sub(target,position);curvedSlide=true;}
  distance=M.length(slide);if(distance>.0000001)d=M.mul(slide,1/distance);
 }
 return {position,blocked,kind};
}
root.SphereFlight={move,contact,sphereRoots,CLEARANCE};
})(typeof window==='undefined'?globalThis:window);
