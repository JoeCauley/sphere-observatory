import {borderSolids,ribs,ribSpacing,pipes} from './border.js';

// A point with w=0 represents a direction at infinity. A finite cross-section
// and its vanishing point form an entire half-strip, even when looking along it.
export function shellMesh(originX) {
  const vertices=[], stone=[.32,.37,.35], grass=[.16,.25,.18], iron=[.18,.32,.32];
  const point=(x,y,z)=>[x-originX,y,z,1];
  function tri(a,b,c,n,col,m){
    for(const [x,y,z,w] of [a,b,c])vertices.push(x,y,z,...n,...col,m,w);
  }
  function quad(a,b,c,d,n,col,m){tri(a,b,c,n,col,m);tri(a,c,d,n,col,m);}
  function strip(l,r,a,b,n,col,m){
    // Split near the eye to maintain metre-scale precision many kilometres out.
    const cuts=[l,...[originX-252,originX+252].filter(x=>x>l&&x<r),r];
    for(let i=1;i<cuts.length;i++){
      const u=cuts[i-1],v=cuts[i];
      if(u===-Infinity)tri(point(v,...a),point(v,...b),[-1,0,0,0],n,col,m);
      else if(v===Infinity)tri(point(u,...a),point(u,...b),[1,0,0,0],n,col,m);
      else quad(point(u,...a),point(u,...b),point(v,...b),point(v,...a),n,col,m);
    }
  }
  function box([l,r,b,t,f,g],col,m){
    strip(l,r,[b,f],[t,f],[0,0,-1],col,m);
    strip(l,r,[b,g],[t,g],[0,0,1],col,m);
    strip(l,r,[t,f],[t,g],[0,1,0],col,m);
    if(b>0)strip(l,r,[b,f],[b,g],[0,-1,0],col,m);
    for(const [x,sign] of [[l,-1],[r,1]])if(Number.isFinite(x))
      quad(point(x,b,f),point(x,t,f),point(x,t,g),point(x,b,g),[sign,0,0],col,m);
  }
  const center=[0,0,0,1], compass=[[1,0,1,0],[-1,0,1,0],[-1,0,-1,0],[1,0,-1,0]];
  for(let i=0;i<4;i++)tri(center,compass[i],compass[(i+1)%4],[0,1,0],grass,1);
  for(const bounds of borderSolids)box(bounds,stone,0);
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
