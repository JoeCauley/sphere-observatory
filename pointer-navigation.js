/* Pick what was marked, including rendered geometry. A pinned Shade address is
 * transported with that Shade; moving to a UI button never changes the address. */
(function(root){
'use strict';const M=root.SphereMath,C=root.SphereCollection,S=root.SphereSites;
function pick(s,ray,{aspect=16/9}={}){
 ray=M.norm(ray);const firstShell=M.sphereDistance(s.position,ray,[0,0,0],s.radius),analytic=M.trace(s.position,ray,s);
 const outside=M.length(s.position)>s.radius+Math.max(.00001,s.radius*Number.EPSILON*16);
 const throughOpening=outside&&Number.isFinite(firstShell)&&M.inBreach(M.norm(M.add(s.position,M.mul(ray,firstShell))),s);
 // A Wound is an entrance when viewed from the cavity. From its exterior
 // spill it is a window: use the visible far hit, not the empty near crossing.
 const shell=throughOpening?(analytic.kind==='Inner surface'?analytic.distance:Infinity):firstShell;
 let distance=Math.min(shell,analytic.distance),meshHit=null,normal=null;
 for(const mesh of S.geometry(s)){const contact={},local=mesh.local(s.position),d=mesh.basis.map(v=>M.dot(ray,v)),hit=S.rayBVH(local,d,mesh.bvh,distance,contact);if(hit<distance){distance=hit;meshHit=mesh;normal=contact.normal?mesh.basis.reduce((sum,v,i)=>M.add(sum,M.mul(v,contact.normal[i])),[0,0,0]):M.mul(ray,-1);}}
 if(!Number.isFinite(distance))return null;const point=M.add(s.position,M.mul(ray,distance));
 let plate=meshHit?.plate;
 if(!meshHit&&analytic.kind==='Shade'&&analytic.distance<=shell){plate=C.plates(s).find(p=>Math.abs(C.diskDistance(M.mul(s.position,1/s.radius),ray,p)*s.radius-distance)<.001);if(plate)normal=plate.shape==='cap'||plate.shape==='trimmed'?M.norm(point):plate.normal;}
 if(normal&&M.dot(normal,ray)>0)normal=M.mul(normal,-1);
 if(plate){const axes=[plate.right,plate.normal,plate.up],relative=M.sub(point,M.mul(plate.center,s.radius));return {type:'shade',ray,point,normal,plate:plate.id,local:axes.map(v=>M.dot(relative,v)),normalLocal:axes.map(v=>M.dot(normal,v)),title:'Shade '+plate.id};}
 if(meshHit)return {type:'geometry',ray,point,normal,standOff:M.clamp(distance*.08,.015,.2),title:meshHit.name};
 if(analytic.distance<shell&&['Star','Stellar station'].includes(analytic.kind))return {type:analytic.kind==='Star'?'star':'station',ray,point,title:analytic.kind};
 if(Number.isFinite(shell)){const selected=M.norm(point),arrival=root.SphereArrival.atPoint({...s,forward:ray},selected,{aspect});return {type:'shell',ray,point,selected,aspect,title:arrival.title};}
 return null;
}
function arrive(input,target){
 if(!target)return null;const s={...input,walkMode:false,walkSurface:false,walkPosition:null,walkVelocity:0,shadeAttachment:null,projection:'perspective'},ray=target.ray;
 if(target.type==='shell'){const result=root.SphereArrival.atPoint({...s,forward:ray},target.selected,{aspect:target.aspect});result.state.speed=input.speed;
  if(result.kind==='ground'){result.state.forward=target.selected.slice();result.state.up=M.basis(result.state.forward,input.up).u;}
  return result;
 }
 if(target.type==='shade'){const plate=C.plates(s).find(p=>p.id===target.plate);if(!plate)return null;const axes=[plate.right,plate.normal,plate.up],point=axes.reduce((p,v,i)=>M.add(p,M.mul(v,target.local[i])),M.mul(plate.center,s.radius)),normal=M.norm(axes.reduce((p,v,i)=>M.add(p,M.mul(v,target.normalLocal[i])),[0,0,0]));
  Object.assign(s,{position:M.add(point,M.mul(normal,.05)),forward:M.mul(normal,-1),up:M.basis(M.mul(normal,-1),input.up).u,siteId:'shade-'+plate.id,siteAnchor:plate.normal,siteRevision:0,siteElevation:0,shadeAttachment:plate.id,geometryDetail:true});
 }else if(target.type==='geometry'){Object.assign(s,{position:M.add(target.point,M.mul(target.normal,target.standOff)),forward:M.mul(target.normal,-1),up:M.basis(M.mul(target.normal,-1),input.up).u,geometryDetail:true});}
 else{const q=M.norm(target.point),star=target.type==='star';Object.assign(s,{position:star?M.mul(q,s.starRadius*1.1):M.sub(target.point,M.mul(ray,Math.max(1,s.starRadius*.01))),forward:star?M.mul(q,-1):ray,siteId:'',siteAnchor:null,siteRevision:0,siteElevation:0});s.up=M.basis(s.forward,input.up).u;}
 return {state:s,title:target.title+' · pointer arrival',kind:target.type,selected:target.point};
}
root.SpherePointer={pick,arrive};
})(typeof window==='undefined'?globalThis:window);
