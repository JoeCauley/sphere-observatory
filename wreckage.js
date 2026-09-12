/* Original dimensional wreckage. Sizes and construction pitches are kilometres. */
(function(root){
'use strict';const M=root.SphereMath,W=root.SphereWorld;
function build(s,mesh,rnd,fleetsOnly){
 // Transform individual assemblies before merging them into a small number of
 // static draw calls. Each fragment has its own roll, pitch and yaw.
 function assembly(center,yaw,pitch,roll){const raw=new root.SphereSites.Mesh([0,0,0],[[1,0,0],[0,1,0],[0,0,1]]),map=p=>{p=M.rotate(p,[0,0,1],roll);p=M.rotate(p,[1,0,0],pitch);return M.add(center,M.rotate(p,[0,1,0],yaw));};
  return {raw,merge(){for(let i=0;i<raw.triangles.length;i++){const t=raw.triangles[i],offset=i*33;mesh.tri(...t.map(map),raw.data.slice(offset+6,offset+9),raw.data[offset+9],raw.data[offset+10]);}}};
 }
 const steel=[.10,.125,.14],rust=[.20,.125,.065],dark=[.025,.036,.042],warm=[.42,.33,.20];
 function slab(center,size,seed,detail=true){const a=assembly(center,rnd()*6.283,(rnd()-.5)*1.5,(rnd()-.5)*1.5),m=a.raw,n=detail?9:3,pitch=size/n,thickness=size*.14,id=[4,5,0,7,3][seed%5];
  const cells=[];for(let x=0;x<n;x++)for(let z=0;z<n;z++){
   const edge=x===0||z===0||x===n-1||z===n-1,missing=x>n*.62&&z>n*(.45+.22*Math.sin(x*2.7));if(missing||(edge&&rnd()<.35))continue;
   const xx=(x-(n-1)*.5)*pitch,zz=(z-(n-1)*.5)*pitch,warp=.018*size*Math.sin(x*.6)*Math.cos(z*.4);cells.push([xx,zz,warp]);
   const c=W.palette[id].map(v=>v*(.7+rnd()*.45));m.box([xx,warp,zz],[pitch*.96,pitch*.06,pitch*.96],c,0,false,0,[-4,-4,-4,-4,20+id,-4]);
   if(detail&&rnd()>.22){m.box([xx,-thickness+warp,zz],[pitch*.94,pitch*.06,pitch*.94],steel,0,false,0,-4);m.box([xx,warp-thickness*.55,zz],[pitch*.035,thickness,pitch*.035],rust,0,false);}
   if(detail&&rnd()>.8){m.box([xx+pitch*.12,warp+pitch*.09,zz],[pitch*.38,pitch*.17,pitch*.55],steel,0,false,0,-4);for(let j=0;j<4;j++)m.box([xx+(j-1.5)*pitch*.08,warp+pitch*.19,zz],[pitch*.018,pitch*.035,pitch*.5],dark,0,false);}
  }
  if(detail){for(let row=0;row<6;row++){const x=(row-2.5)*size/6;for(let j=0;j<7;j++){const z=(j-3)*size/7,d=size/7;m.beam([x,-thickness,z],[x,-.015*size,z+d],size*.008,steel);m.beam([x,-.015*size,z],[x,-thickness,z+d],size*.008,steel);}m.box([x,-thickness*.5,0],[size*.013,size*.015,size],warm,0,false);}
   for(let j=0;j<12;j++){const x=(rnd()-.5)*size,z=(rnd()-.5)*size,reach=(.1+rnd()*.15)*size;m.beam([x,-thickness*.5,z],[x+reach,-thickness*(.5+rnd()),z+reach*.3],size*.007,rust);}
  }a.merge();
 }
 function ship(center,size,index,active){const a=assembly(center,(rnd()-.5)*.8,(rnd()-.5)*.2,(rnd()-.5)*.5),m=a.raw;
  m.box([0,0,0],[size*.24,size*.19,size*2.2],steel,0,false,0,-4);m.box([0,-size*.08,-size*.1],[size*.64,size*.09,size*.9],dark,0,false,0,-4);
  for(const x of [-1,1]){m.box([x*size*.39,0,-size*.23],[size*.16,size*.12,size*1.45],steel,0,false,0,-4);m.beam([0,0,size*.5],[x*size*.4,0,-size*.35],size*.04,rust);m.box([x*size*.39,0,-size*.98],[size*.11,size*.07,size*.014],[.035,.28,.48],0,false,active?.8:.015);}
  for(let k=0;k<10;k++){const z=(k-5)*size*.16;m.box([0,size*.12,z],[size*.34,size*.045,size*.035],warm,0,false);if(k%3===0){m.box([0,size*.19,z],[size*.10,size*.09,size*.14],dark,0,false);m.box([0,size*.22,z+size*.10],[size*.025,size*.025,size*.24],steel,0,false);}}
  m.box([0,size*.22,-size*.45],[size*.19,size*.2,size*.22],steel,0,false,0,-4);m.box([0,size*.26,-size*.33],[size*.17,size*.028,size*.005],[.055,.30,.35],0,false,active?.18:.01);
  if(active){const pulse=Math.max(0,Math.sin(s.time*.65+index*7))**45;if(pulse>.03)m.box([0,size*.23,size*1.13],[size*.023,size*.023,size*.06],[.85,.32,.08],0,false,pulse*6);}
  a.merge();
 }
 if(!fleetsOnly){
  // Readable landmarks frame the approach. The nearest is an 18 km remnant.
  const anchors=[[-14,-9,35,18],[25,-19,67,28],[-42,8,110,35],[60,-38,180,52],[-85,-45,220,65],[8,-65,290,85]];
  anchors.forEach(([x,y,z,size],i)=>slab([x,y,z],size,i+s.spaceEnvironment*2));
  for(let i=0;i<460;i++){const x=(rnd()*2-1)*330,z=(rnd()*2-1)*330,y=(rnd()*2-1)*150;if(Math.hypot(x,y,z)<12)continue;const size=.08+Math.pow(rnd(),3)*5,a=assembly([x,y,z],rnd()*6.28,rnd()*6.28,rnd()*6.28),m=a.raw;
   m.box([0,0,0],[size,size*(.07+rnd()*.18),size*(.3+rnd())],i%3===0?rust:steel,0,false,0,-4);if(i%5===0){m.beam([-.4*size,0,-.3*size],[.4*size,-.4*size,.3*size],size*.055,warm);m.box([0,-size*.22,0],[size*.07,size*.44,size*.07],dark,0,false);}a.merge();
  }
  // A distant volume of small, sharp fragments gives translation parallax.
  for(let i=0;i<1400;i++){const r=500+rnd()*4200,q=M.norm([rnd()*2-1,rnd()*2-1,rnd()*2-1]),p=M.mul(q,r),size=.4+rnd()**3*15,a=assembly(p,rnd()*6.28,rnd()*6.28,rnd()*6.28);a.raw.box([0,0,0],[size,size*.11,size*.48],steel.map(v=>v*(.6+rnd()*.5)),0,false);a.merge();}
  if(s.spaceEnvironment>0)for(let i=0;i<8;i++)ship([15+(rnd()-.5)*170,-15-rnd()*85,80+rnd()*400],2+rnd()*5,i,false);
 }else if(s.spaceEnvironment>0){for(let i=0;i<18;i++){const t=s.spaceEnvironment===2?s.time*.002:0;ship([(rnd()-.5)*220,(rnd()-.5)*65,24+rnd()*240+Math.sin(t*.018+i)*18],.6+rnd()*2,i,s.spaceEnvironment===2);}}
 mesh.extentKm=4600;return mesh;
}
root.SphereWreckage={build};
})(typeof window==='undefined'?globalThis:window);
