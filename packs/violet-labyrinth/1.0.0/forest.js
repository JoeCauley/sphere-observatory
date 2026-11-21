/* Bundled Violet Labyrinth habitat. Positions, heights and radii are in kilometres. */
(function(root){
'use strict';
const M=root.SphereMath,W=root.SphereWorld;
const tau=2*Math.PI, material=-8;
let referenceKey,reference;

function referenceGrove(s){
  const key=[s.seed,s.radius,s.axisLat,s.axisLon,s.waistWidth,s.era,s.layoutVersion].join('/');
  if(key===referenceKey)return reference;
  const anchor=W.locateBiome(9,s),basis=root.SphereSites.shellFrame(anchor),origin=M.mul(anchor,s.radius);
  // Replay the original field site's random stream. The clear landing and all
  // 320 candidate slots keep their old geographic positions and silhouettes.
  let seed=(s.seed*8191+9*977)>>>0;
  const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
  const spires=[];
  for(let i=0;i<320;i++){
    const x=(random()*2-1)*1.08,z=(random()*2-1)*1.08;
    if(Math.hypot(x,z)<.055)continue;
    const radius=.003+random()*.009,height=(.008+random()*.036)*2.55;
    const rotation=random()*tau,variation=.6+random()*.6;
    const q=M.norm(M.add(origin,M.add(M.mul(basis[0],x),M.mul(basis[2],z))));
    spires.push({q,radius,height,rotation,variation,id:'violet/'+s.seed+'/reference/'+i});
  }
  referenceKey=key;reference={anchor,origin,basis,spires};return reference;
}

// The GPU samples these same two winding seams for the distant grove pattern.
function cover(q,s){
  const p=q.map(n=>((n*s.radius/16)%64+64)%64+s.seed*.03125);
  const wave=(a,b,c)=>Math.sin(tau*(a+b*.5))+Math.sin(tau*(b*.5-c*.25))*.55;
  return Math.min(Math.abs(wave(...p)),Math.abs(wave(p[2],p[0],p[1])-.34));
}
const glsl=`
float violetVein(vec3 p){return sin(6.2831853*(p.x+p.y*.5))+.55*sin(6.2831853*(p.y*.5-p.z*.25));}
float violetGrove(vec3 p){float gap=min(abs(violetVein(p)),abs(violetVein(p.zxy)-.34));return smoothstep(.04,.28,gap);}
`;
function emit(mesh,base,axes,spire){
  const {radius,height,rotation,variation}=spire;
  const point=(angle,r,h)=>M.add(base,M.add(M.mul(axes[1],h),M.add(M.mul(axes[0],Math.cos(angle)*r),M.mul(axes[2],Math.sin(angle)*r))));
  const tip=M.add(base,M.mul(axes[1],height));
  for(let side=0;side<6;side++){
    const a=rotation+side*tau/6,b=a+tau/6;
    const foot=point(a,radius,0),next=point(b,radius,0);
    const crown=point(a,radius*.75,height*2/2.55),nextCrown=point(b,radius*.75,height*2/2.55);
    const tint=variation*(.84+.16*Math.cos(a));
    mesh.quad(foot,next,nextCrown,crown,[.21*tint,.09*tint,.29*tint],material);
    mesh.tri(crown,nextCrown,tip,[.42*tint,.24*tint,.53*tint],material);
  }
}
root.SphereVioletForest={referenceGrove,cover,emit,glsl,material};
})(typeof window==='undefined'?globalThis:window);
