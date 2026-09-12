/* Camera transport in a moving Shade frame; no integration drift or assumed orbital dynamics. */
(function(root){
'use strict';const M=root.SphereMath,C=root.SphereCollection;
function plate(s){return Number.isInteger(s.shadeAttachment)&&s.siteId==='shade-'+s.shadeAttachment?C.plates(s).find(p=>p.id===s.shadeAttachment):null;}
function transport(previous,next){
 const old=plate(previous),current=plate(next);if(!old||!current){next.shadeAttachment=null;return false;}
 if(previous.shadeShape!==next.shadeShape&&root.SphereSites){const a=root.SphereSites.shadeSection(previous),b=root.SphereSites.shadeSection(next),turn=v=>b.basis.reduce((sum,axis,i)=>M.add(sum,M.mul(axis,M.dot(v,a.basis[i]))),[0,0,0]);next.position=b.world(a.local(previous.position));next.forward=M.norm(turn(previous.forward));next.up=M.basis(next.forward,turn(previous.up)).u;next.siteAnchor=current.normal.slice();return true;}
 const from=[old.right,old.normal,old.up],to=[current.right,current.normal,current.up],rotate=v=>to.reduce((sum,b,i)=>M.add(sum,M.mul(b,M.dot(v,from[i]))),[0,0,0]);
 const offset=M.sub(previous.position,M.mul(old.center,previous.radius));
 next.position=M.add(M.mul(current.center,next.radius),rotate(offset));next.forward=M.norm(rotate(previous.forward));next.up=M.basis(next.forward,rotate(previous.up)).u;next.siteAnchor=current.normal.slice();return true;
}
function setTime(s,time){const previous={...s};s.time=time;if(s.shadeAttachment!==null)transport(previous,s);return s;}
function surface(s){
 const p=plate(s);if(p){const r=M.length(p.center)*s.radius,curved=p.shape==='cap'||p.shape==='trimmed',q=curved?M.norm(s.position):p.normal;
  const h=curved?r-M.length(s.position):-M.dot(M.sub(s.position,M.mul(p.center,s.radius)),p.normal);
  return {up:M.mul(q,h>=0?-1:1),altitude:Math.abs(h),name:'Shade '+p.id};
 }
 const h=s.radius-M.length(s.position);return {up:M.mul(M.norm(s.position),h>=0?-1:1),altitude:Math.abs(h),name:h>=0?'inner surface':'outer surface'};
}
function level(s,limit=1){
 if(s.surfaceLock===false||s.walkMode)return false;const ground=surface(s);if(ground.altitude>limit)return false;
 // Keep the chosen pitch. Near the zenith/nadir roll is undefined, so preserve the last orientation.
 if(Math.abs(M.dot(M.norm(s.forward),ground.up))>.9998)return false;
 const up=M.basis(s.forward,ground.up).u,changed=M.length(M.sub(s.up,up))>1e-10;s.up=up;return changed;
}
root.SphereInspection={plate,transport,setTime,surface,level};
})(typeof window==='undefined'?globalThis:window);
