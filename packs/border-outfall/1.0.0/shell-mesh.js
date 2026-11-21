import {borderSolids,ribs,ribSpacing,pipes} from './border.js';

import {farEdgeM,roofM,rampEastM,rampHalfM,rampRunM,rampLandingM} from '../../kit/border-profile.js';

// The outdoor horizon is drawn by the ground renderer. Subdivide physical walls
// on both axes so their distant profiles meet that same surface.
const rings=[-96000,-64000,-40000,-24000,-12000,-6000,-2000,-252,0,252,2000,6000,12000,24000,40000,64000,96000];
export function shellMesh(originX,originZ=0) {
  const vertices=[], stone=[.32,.37,.35], grass=[.16,.25,.18], iron=[.18,.32,.32];
  const point=(x,y,z)=>[x-originX,y,z,1];
  function tri(a,b,c,n,col,m){
    for(const [x,y,z,w] of [a,b,c])vertices.push(x,y,z,...n,...col,m,w);
  }
  function quad(a,b,c,d,n,col,m){tri(a,b,c,n,col,m);tri(a,c,d,n,col,m);}
  function strip(l,r,a,b,n,col,m){
    const lo=Math.max(l,originX-96000),hi=Math.min(r,originX+96000);
    if(lo>=hi)return;
    const cuts=[lo,...rings.map(d=>originX+d).filter(x=>x>lo&&x<hi),hi];
    for(let i=1;i<cuts.length;i++){
      const u=cuts[i-1],v=cuts[i];
      quad(point(u,...a),point(u,...b),point(v,...b),point(v,...a),n,col,m);
    }
  }
  function box([l,r,b,t,f,g],col,m){
    strip(l,r,[b,f],[t,f],[0,0,-1],col,m);
    strip(l,r,[b,g],[t,g],[0,0,1],col,m);
    const z0=Math.max(f,originZ-96000),z1=Math.min(g,originZ+96000);
    const slices=[z0,...rings.map(d=>originZ+d).filter(z=>z>z0&&z<z1),z1];
    for(let i=1;z0<z1 && i<slices.length;i++){
      strip(l,r,[t,slices[i-1]],[t,slices[i]],[0,1,0],col,m);
      if(b>0)strip(l,r,[b,slices[i-1]],[b,slices[i]],[0,-1,0],col,m);
      for(const [x,sign] of [[l,-1],[r,1]])if(Number.isFinite(x) && Math.abs(x-originX)<=96000){
        const front=slices[i-1],back=slices[i];
        quad(point(x,b,front),point(x,t,front),point(x,t,back),point(x,b,back),[sign,0,0],col,m);
      }
    }
  }
  // A projective floor must touch the local tangent. Curving a fixed entrance vertex
  // raises it above the eye about 713 km down a one-AU corridor.
  const center=[0,0,originZ,1], compass=[[1,0,1,0],[-1,0,1,0],[-1,0,-1,0],[1,0,-1,0]];
  for(let i=0;i<4;i++)tri(center,compass[i],compass[(i+1)%4],[0,1,0],grass,1);
  for(const bounds of borderSolids)box(bounds,stone,0);
  const west=rampEastM-rampHalfM,east=rampEastM+rampHalfM;
  for(const [foot,crest] of [[-rampRunM,0],[farEdgeM+rampRunM,farEdgeM]]){
    const sign=Math.sign(foot-crest),landing=crest+sign*rampLandingM;
    quad(point(west,0,foot),point(east,0,foot),point(east,roofM,landing),point(west,roofM,landing),[0,1,sign*.1],iron,5);
    quad(point(west,roofM,landing),point(east,roofM,landing),point(east,roofM,crest),point(west,roofM,crest),[0,1,0],iron,5);
    for(const x of [west,east])tri(point(x,0,foot),point(x,0,crest),point(x,roofM,crest),[x===west?-1:1,0,0],stone,0);
  }
  // At the outer ring the atmospheric transmission is below one part in 1,000.
  for(let i=-126;i<=126;i++){
    const x=originX+i*ribSpacing;
    if(x===0)continue;
    for(const [w,h,f,g] of ribs)box([x-w,x+w,0,h,f,g],stone,0);
  }
  for(const y of pipes){
    for(let i=0;i<16;i++){
      const a=i*Math.PI/8,b=(i+1)*Math.PI/8,mid=(a+b)/2;
      const rim=t=>[y+.93*Math.cos(t),41.5+.93*Math.sin(t)];
      strip(-Infinity,Infinity,rim(a),rim(b),[0,Math.cos(mid),Math.sin(mid)],iron,15);
    }
  }
  return new Float32Array(vertices);
}
