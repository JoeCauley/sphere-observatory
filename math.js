/* Geometry in kilometres and radians. CPU calculations use JavaScript doubles. */
(function(root) {
  'use strict';
  const AU = 149597870.7, SUN = 695700, PI = Math.PI;
  const add=(a,b)=>a.map((v,i)=>v+b[i]), sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const mul=(a,s)=>a.map(v=>v*s), dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const length=a=>Math.hypot(...a), norm=a=>mul(a,1/(length(a)||1)).map(v=>v===0?0:v);
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const radians=v=>v*PI/180, degrees=v=>v*180/PI;
  function axis(lat,lon) { lat=radians(lat);lon=radians(lon);return [Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon)]; }
  function latlon(v) {const n=norm(v);return [degrees(Math.asin(clamp(n[1],-1,1))),degrees(Math.atan2(n[0],n[2]))];}
  function rotate(v,a,t) {a=norm(a);return add(add(mul(v,Math.cos(t)),mul(cross(a,v),Math.sin(t))),mul(a,dot(a,v)*(1-Math.cos(t))));}
  function basis(forward, up=[0,1,0]) {
    const f=norm(forward); if(Math.abs(dot(f,norm(up)))>.999) up=Math.abs(f[0])<.9?[1,0,0]:[0,1,0];
    const r=norm(cross(f,up)); return {f,r,u:norm(cross(r,f))};
  }
  // Stable inside-shell root, retaining small altitude separately from large radius.
  function shellDistance(p,d,R) {
    const r=length(p),h=R-r,b=dot(p,d),c=-h*(2*R-h),disc=b*b-c;
    if(disc<0)return Infinity;
    const s=Math.sqrt(disc);
    const far=b>0?-c/(b+s):-b+s;
    return far>0?far:Infinity;
  }
  function sphereDistance(p,d,center,radius) {
    const o=sub(p,center),b=dot(o,d),perp=cross(o,d),disc=radius*radius-dot(perp,perp);
    if(disc<0)return Infinity;
    const s=Math.sqrt(disc),near=-b-s,far=-b+s;
    return near>0?near:(far>0?far:Infinity);
  }
  function shade(s) {
    const offset=s.shadeOffset*s.shadeDiameter/2 + s.time*s.shadeSpeed;
    return {center:[offset,0,s.radius-s.shadeAltitude],radius:s.shadeDiameter/2,damage:s.shadeDamage};
  }
  function plateContains(x,y,p) {
    if(Math.hypot(x,y)>p.radius)return false;
    // A macroscopic circular notch cut out of the left edge.
    if(p.damage>0 && Math.hypot(x+p.radius*.86,y-p.radius*.18)<p.radius*.42*p.damage)return false;
    return true;
  }
  function plateDistance(p,d,plate) {
    if(Math.abs(d[2])<1e-15)return Infinity;
    const t=(plate.center[2]-p[2])/d[2];
    if(t<=0)return Infinity;
    return plateContains(p[0]+d[0]*t-plate.center[0],p[1]+d[1]*t-plate.center[1],plate)?t:Infinity;
  }
  function inBreach(q,s) {
    if(!s.breachEnabled)return false;
    const ax=axis(s.breachLat,s.breachLon),delta=sub(norm(q),ax),b=basis(ax),ang=Math.atan2(dot(delta,b.u),dot(delta,b.r));
    const edge=1+(s.breachRoughness||0)*(.12*Math.sin(5*ang)+.05*Math.sin(13*ang)+.03*Math.sin(29*ang));
    return length(delta) < 2*Math.sin(s.breachDiameter/(4*s.radius))*edge;
  }
  function trace(p,d,s) {
    let distance=sphereDistance(p,d,[0,0,0],s.starRadius),kind='Star';
    const sh=s.shadeEnabled?plateDistance(p,d,shade(s)):Infinity;
    if(sh<distance){distance=sh;kind='Shade';}
    const shell=shellDistance(p,d,s.radius),point=add(p,mul(d,shell));
    if(shell<distance&&!inBreach(point,s)){distance=shell;kind='Inner surface';}
    if(!Number.isFinite(distance))return {kind:'Open space',distance:Infinity,point:null};
    return {kind,distance,point:add(p,mul(d,distance))};
  }
  function sunVisibility(p,s,samples=256) {
    if(!s.shadeEnabled)return 1;
    const st=basis(mul(p,-1)),dist=length(p),rad=Math.tan(Math.asin(s.starRadius/dist)),pl=shade(s);
    let visible=0;
    for(let i=0;i<samples;i++){
      const rho=Math.sqrt((i+.5)/samples)*rad,ang=i*2.399963229728653;
      const d=norm(add(st.f,add(mul(st.r,rho*Math.cos(ang)),mul(st.u,rho*Math.sin(ang))))),t=plateDistance(p,d,pl);
      if(t>=sphereDistance(p,d,[0,0,0],s.starRadius))visible++;
    }
    return visible/samples;
  }
  function ray(x,y,aspect,hfov,b,panorama=false) {
    if(panorama){const lon=x*PI,lat=y*PI/2;return norm(add(add(mul(b.f,Math.cos(lat)*Math.cos(lon)),mul(b.r,Math.cos(lat)*Math.sin(lon))),mul(b.u,Math.sin(lat))));}
    const t=Math.tan(radians(hfov)/2);return norm(add(add(b.f,mul(b.r,x*t)),mul(b.u,y*t/aspect)));
  }
  function defaultState() {return {
    version:1,radius:AU,starRadius:SUN,luminosity:1,
    position:[0,0,AU*.5],forward:[0,0,1],up:[0,1,0],fov:100,
    breachEnabled:true,breachLat:12,breachLon:-12,breachDiameter:35000000,breachRoughness:0,surfaceStyle:'atlas',
    shadeEnabled:true,shadeAltitude:100000,shadeDiameter:100000,shadeOffset:0,shadeSpeed:2,shadeDamage:0,
    time:0,playing:false,timeRate:60,exposure:.4,shellshine:.06,atmosphere:1,
    grid:false,viewMode:'material',projection:'perspective',speed:1000000,
    quality:1,seed:23,starfield:true
  };}
  const numeric={radius:[1e7,1e9],starRadius:[10000,2e6],luminosity:[.001,100],fov:[10,150],breachLat:[-90,90],breachLon:[-180,180],breachDiameter:[1000,1.5e8],breachRoughness:[0,1],shadeAltitude:[1000,1e7],shadeDiameter:[100,2e7],shadeOffset:[-20,20],shadeSpeed:[-100,100],shadeDamage:[0,1],time:[-1e9,1e9],timeRate:[.1,3600],exposure:[-10,12],shellshine:[0,.5],atmosphere:[0,1],speed:[1,3e7],quality:[.35,1],seed:[0,1000]};
  function validate(input) {
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('This is not a Sphere scene file.');
    const s=defaultState();
    for(const [k,[lo,hi]] of Object.entries(numeric))if(k in input){if(!Number.isFinite(input[k])||input[k]<(k==='speed'&&input.layoutVersion===2?.001:lo)||input[k]>hi)throw Error('Invalid value for '+k);s[k]=input[k];}
    for(const k of ['position','forward','up'])if(k in input){if(!Array.isArray(input[k])||input[k].length!==3||!input[k].every(Number.isFinite))throw Error('Invalid camera '+k);s[k]=[...input[k]];}
    if(length(s.position)>=(input.layoutVersion===2?s.radius*2:s.radius-0.5)||length(s.position)<=s.starRadius*1.01)throw Error(input.layoutVersion===2?'Camera must remain outside the star and within two shell radii.':'Camera must be inside the shell and outside the star.');
    if(s.shadeAltitude>=s.radius-s.starRadius)throw Error('Shade altitude places it inside the star.');
    if(s.breachDiameter>PI*s.radius)throw Error('Breach is larger than the shell permits.');
    if(length(s.forward)<.1||length(s.up)<.1)throw Error('Camera orientation is missing.');
    const b=basis(s.forward,s.up);s.forward=b.f;s.up=b.u;
    for(const k of ['breachEnabled','shadeEnabled','grid','starfield'])if(typeof input[k]==='boolean')s[k]=input[k];
    if(['material','distance'].includes(input.viewMode))s.viewMode=input.viewMode;
    if(['perspective','panorama'].includes(input.projection))s.projection=input.projection;
    if(['atlas','legacy'].includes(input.surfaceStyle))s.surfaceStyle=input.surfaceStyle;
    s.playing=false;return s;
  }
  function sceneRecord(s,extra={}) {return {format:'sphere-observatory',version:1,created:new Date().toISOString(),state:JSON.parse(JSON.stringify(s)),...extra};}
  const api={AU,SUN,PI,add,sub,mul,dot,cross,length,norm,clamp,radians,degrees,axis,latlon,rotate,basis,shellDistance,sphereDistance,shade,plateContains,plateDistance,inBreach,trace,sunVisibility,ray,defaultState,validate,sceneRecord};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.SphereMath=api;
})(typeof window!=='undefined'?window:globalThis);
