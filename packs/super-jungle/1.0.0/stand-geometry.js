/* One source of geographic silhouettes and walking geometry for a surveyed Jungle stand. */
(function(root){
'use strict';
const tau=2*Math.PI;
function emit(mesh,frame,state,stand,bounds,walking,height,props){
  if(!stand)return;
  const {SphereMath:M,SphereSites:S}=root;
  const local=q=>frame.local(M.mul(q,state.radius));
  const owns=p=>p[0]>=bounds[0]&&p[0]<bounds[2]&&p[2]>=bounds[1]&&p[2]<bounds[3];
  function geometry(q,axis){
    const p=local(q),up=S.shellFrame(q)[1];
    const basis=axis?M.norm(M.sub(axis,M.mul(up,M.dot(axis,up)))):S.shellFrame(q)[0];
    const side=M.cross(basis,up);
    const inFrame=v=>frame.basis.map(b=>M.dot(b,v));
    const ex=inFrame(basis),ez=inFrame(side);
    const base=height(p[0],p[2]);
    const at=(a,h,b)=>{
      const x=p[0]+(ex[0]*a+ez[0]*b)*.001,z=p[2]+(ex[2]*a+ez[2]*b)*.001;
      return [x,(axis?height(x,z):base)+h*.001,z];
    };
    return at;
  }
  const tube=(a,b,ra,rb,tint,steps=7)=>{
    const delta=M.norm(M.sub(b,a));let u=M.cross(delta,[0,1,0]);
    if(M.length(u)<.01)u=M.cross(delta,[1,0,0]);
    u=M.norm(u);const v=M.cross(delta,u);
    const ring=(p,r,i)=>M.add(p,M.add(M.mul(u,.001*r*Math.cos(tau*i/steps)),M.mul(v,.001*r*Math.sin(tau*i/steps))));
    for(let i=0;i<steps;i++){
      const c=tint.map(k=>k*(.82+.18*(i%3)/2));
      mesh.quad(ring(a,ra,i),ring(a,ra,i+1),ring(b,rb,i+1),ring(b,rb,i),c,-16);
    }
  };
  const bark=[.29,.175,.095],wood=[.55,.35,.17],earth=[.285,.155,.072],moss=[.18,.23,.09];
  const fall=stand.fallen;
  if(owns(local(fall.direction))){
    const axis=M.sub(fall.tipQ,fall.direction),at=geometry(fall.direction,axis),L=fall.lengthM;
    // A cross-section through the heaved root fan. Its base and the trunk follow the terrain independently.
    const outline=[[-8,-.14],[-8.7,3.5],[-6.1,5.8],[-6.8,7.7],[-3.8,7.1],[-1.6,9.8],[.5,8.1],[3.4,10.1],[4.8,7.3],[7.6,6.5],[6.8,4.1],[8.5,2.8],[7.8,-.12]];
    const hub=at(-.8,3.1,0),back=at(1.3,2.9,0);
    const rim=outline.map(([z,h],i)=>at(-1.0-h*.22+.25*Math.sin(5*i),h,z));
    const backRim=outline.map(([z,h])=>at(.5-h*.16,h*.91,z*.93));
    for(let i=0;i<rim.length;i++){
      const n=(i+1)%rim.length,c=i%4===0?moss:earth;
      mesh.tri(hub,rim[n],rim[i],c,-16);mesh.tri(back,backRim[i],backRim[n],earth,-16);
      mesh.quad(rim[i],rim[n],backRim[n],backRim[i],i%3?bark:moss,-16);
    }
    const points=[at(0,2.65,0),at(L*.24,2.3,.8),at(L*.56,1.85,-.6),at(L*.82,1.25,-1),at(L,.72,.35)];
    const radii=[2.8,2.45,1.97,1.28,.77];
    for(let i=1;i<points.length;i++)tube(points[i-1],points[i],radii[i-1],radii[i],bark,walking?9:6);
    for(let i=1;i<outline.length-1;i++){
      const [z,h]=outline[i],a=at(-2.0,2.1,z*.15),b=at(-2.0-h*.23,h*.63,z*.62),c=at(-1.25-h*.24,h+.45,z);
      tube(a,b,.74,.42,wood,walking?5:3);tube(b,c,.43,.16,wood,walking?5:3);
      if(walking){const fork=at(-1.7-h*.20,h+1.15,z+.85*Math.sin(i*2));tube(b,fork,.26,.055,bark,4);}
    }
    if(walking){
      // Stripped lateral roots project out of the soil face and taper back toward the ground.
      for(const sign of [-1,1]){
        for(let i=0;i<3;i++){
          const z=sign*(2.1+1.65*i),knuckle=at(-3.3-i*.45,3.6+.52*i,z);
          const elbow=at(-4.1-i*.65,2.6+.23*i,z+sign*(1.8+i*.22));
          tube(at(-2.1,2.5,z*.54),knuckle,.46,.32,wood,6);
          tube(knuckle,elbow,.34,.23,bark,5);
          tube(elbow,at(-5.1-i*.51,.23+.58*i,z+sign*(2.8+i*.47)),.22,.045,wood,4);
        }
      }
    }
    tube(points[2],at(L*.67,4.4,4),1.05,.32,wood,6);tube(points[3],at(L*.90,2.7,-4),.67,.17,bark,5);
    // Small moss shelves run along the top of the log rather than floating over it.
    if(walking)for(let i=0;i<7;i++){
      const distance=L*(.14+i*.09),top=4.9-3.3*(distance/L);
      mesh.tri(at(distance-1.7,top,-.25),at(distance+1.45,top-.25,.7),at(distance+.4,top+.05,-.55),moss,-17);
    }
    props.push(fall.id);
  }
  function crown(at,x,h,z,r,phase,tint){
    const ring=[],top=at(x+.15*r,h+.42*r,z),lower=at(x,h-.25*r,z);
    for(let k=0;k<8;k++){const a=phase+k*tau/8,reach=r*(k%2?.80:1);ring.push(at(x+Math.cos(a)*reach,h+.1*r*Math.sin(k*1.8+phase),z+Math.sin(a)*reach));}
    for(let k=0;k<8;k++){const n=(k+1)%8;mesh.tri(top,ring[n],ring[k],tint,-17);mesh.tri(lower,ring[k],ring[n],tint.map(v=>v*.68),-17);}
  }
  function tree(t,native=false){
    if(!owns(local(t.q)))return;
    const at=geometry(t.q),r=t.radiusM,h=t.heightM,phase=t.phase;
    if(!native){
      tube(at(0,-.12,0),at(.42,h*.77,.8),h*.031,h*.011,bark,walking?6:4);
      if(walking)for(let k=0;k<3;k++){const a=phase+k*tau/3;
        mesh.tri(at(0,h*.19,0),at(Math.cos(a)*r*.32,-.06,Math.sin(a)*r*.32),at(Math.cos(a+.7)*r*.10,0,Math.sin(a+.7)*r*.10),bark,-16);}
    }
    for(let k=0;k<3;k++){
      const a=phase+k*2.4,spread=k===2?.16:.60+.14*k;
      const x=Math.cos(a)*r*spread,z=Math.sin(a)*r*spread,y=h*(.6+.15*k);
      if(walking&&!native)tube(at(.2,y-h*.15,.4),at(x,y,z),.53,.21,bark,4);
      const green=t.tint??.44;
      crown(at,x,y,z,r*(.68+.08*k),a,[.056+.026*green+.009*k,.155+.067*green+.022*k,.063+.025*green]);
    }
    props.push(t.id);
  }
  // The old buttress already owns a detailed native mesh. Only its distant outline is needed here.
  if(!walking)tree(stand.buttress,true);
  for(const t of stand.trees)tree(t);
  if(walking)for(const fan of stand.ferns){
    if(!owns(local(fan.q)))continue;
    const at=geometry(fan.q),scale=fan.sizeM,soft=mesh.triangles.length;
    for(let i=0;i<7;i++){
      const a=fan.phase+2.4*i,reach=scale*(.76+.13*(i%3));
      const pt=(s,h,off=0)=>at(Math.cos(a)*s-Math.sin(a)*off,h,Math.sin(a)*s+Math.cos(a)*off);
      const stem=pt(0,.05),tip=pt(reach,scale*.37),crest=pt(reach*.48,scale*.66);
      for(const sign of [-1,1]){
        const edge=pt(reach*.55,scale*.54,reach*.12*sign);
        mesh.tri(stem,edge,crest,[.115,.295,.105],-17);mesh.tri(crest,edge,tip,[.15,.33,.112],-17);
      }
    }
    mesh.triangles.length=soft;
  }
}
root.SphereJungleStand={emit};
})(typeof window==='undefined'?globalThis:window);
