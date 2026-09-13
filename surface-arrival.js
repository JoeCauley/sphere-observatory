/* Select the first shell crossing, then frame a local surface or fracture inspection. */
(function(root){
'use strict';const M=root.SphereMath,W=root.SphereWorld;
function edgeRange(s){return Math.max(25,Math.min(1000,s.shellThickness*80));}
function rimScreenDistance(s,near,aspect){
 const v=M.sub(M.mul(near.point,s.radius),s.position),b=M.basis(s.forward,s.up),z=M.dot(v,b.f),scale=Math.tan(M.radians(s.fov)*.5);
 if(z<=0)return Infinity;
 // Fraction of viewport height from the crosshair; independent of render resolution.
 return Math.hypot(M.dot(v,b.r),M.dot(v,b.u))*aspect/(2*z*scale);
}
function inspection(s,near,kind){
 const f=W.rimFrame(s,near.index,near.t),wide=kind==='breach',standOff=Math.max(wide?8:.6,s.shellThickness*(wide?.8:.22)),altitude=Math.max(wide?3:.35,s.shellThickness*(wide?.35:.12));
 const q=M.norm(M.add(f.point,M.mul(f.inland,-standOff/s.radius))),position=M.mul(q,s.radius-altitude);
 const target=M.add(M.mul(f.point,s.radius+s.shellThickness*(wide?.22:.025)),M.mul(f.tangent,standOff*.5));
 return {position,forward:M.norm(M.sub(target,position)),up:M.mul(q,-1),siteId:'rim',siteAnchor:f.point,geometryDetail:true,fov:wide?86:78,speed:wide?.2:.05,exposure:Math.max(s.exposure,wide?1.4:1.0)};
}
function spill(s,selected){
 // The breach centre is a different destination from the adjoining ground.
 // Anchor the existing exterior environment in this selected opening, so all
 // six Wounds lead to their own spill rather than a default rim or far wall.
 const up=M.mul(selected,-1),east=M.basis(up).r,basis=[east,up,M.cross(east,up)],origin=M.mul(selected,s.radius+2500);
 const position=M.add(origin,M.mul(basis[2],-4)),target=M.add(origin,M.add(M.mul(basis[0],-14),M.add(M.mul(basis[1],-9),M.mul(basis[2],35))));
 return {position,forward:M.norm(M.sub(target,position)),up:basis[1],siteId:'exterior-0',siteAnchor:selected,geometryDetail:true,wreckage:true,spaceEnvironment:0,fov:78,speed:10,exposure:Math.max(s.exposure,1.5)};
}
function select(s,{aspect=16/9}={}){
 const distance=M.sphereDistance(s.position,s.forward,[0,0,0],s.radius);if(!Number.isFinite(distance))return null;
 return atPoint(s,M.norm(M.add(s.position,M.mul(s.forward,distance))),{aspect});
}
function atPoint(s,selected,{aspect=16/9}={}){
 const near=W.nearestRim(selected,s),opening=M.inBreach(selected,s);
 const screenDistance=rimScreenDistance(s,near,aspect),kind=opening?(near.distance<=edgeRange(s)||(W.woundMetric(selected,s).metric>.65&&screenDistance<=.075)?'edge':'breach'):'ground';
 const state={...s,siteId:'',siteAnchor:null,siteRevision:0,siteElevation:0,walkSurface:false,walkMode:false,walkPosition:null,shadeAttachment:null,projection:'perspective',fov:76};
 let ground=selected,title;
 if(opening){
  Object.assign(state,kind==='breach'?spill(s,selected):inspection(s,near,kind));const f=W.rimFrame(s,near.index,near.t);ground=M.norm(M.add(f.point,M.mul(f.inland,3/s.radius)));
  title='Wound '+(near.index+1)+(kind==='breach'?' · Breach spill':' · '+W.sample(ground,s).name+' edge');
 }else{
  state.position=M.mul(selected,s.radius-3);state.speed=1;
  const tangent=near.distance<=edgeRange(s)?W.rimFrame(s,near.index,near.t).tangent:M.basis(selected).r;
  state.forward=M.norm(M.add(tangent,M.mul(selected,.65)));state.up=M.mul(selected,-1);title=W.sample(selected,s).name+' · selected surface';
 }
 state.up=M.basis(state.forward,state.up).u;
 return {state,title,kind,selected,near,screenDistance,region:W.sample(ground,s)};
}
root.SphereArrival={select,atPoint,edgeRange,rimScreenDistance,inspection,spill};
})(typeof window==='undefined'?globalThis:window);
