/* Automatic boundaries of the combined Shade footprint.
 * Revision 3 closes the continuous 180 m body with finished or broken edges.
 * Revision 2 retains its thin skin. Revision 1 keeps its selected service strip.
 */
(function(root){
'use strict';const M=root.SphereMath,C=root.SphereCollection,W=root.SphereWorld,S=root.SphereSites,E=root.SphereEdges;
const {add,sub,mul,dot,norm,length:len}=M,cache=new Map();
const solid=(p,u,v)=>C.diskContains(u*p.size*(p.across||1),v*p.size,p);
function curves(p){
 const key=[p.shape,p.trim,p.damage,p.id].join('|');if(cache.has(key))return cache.get(key);const out=[];
 const line=(id,a,b,kind='intact')=>out.push({id,kind,lo:0,hi:1,at:t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]});
 const curve=(id,lo,hi,at,kind='broken')=>out.push({id,lo,hi,at,kind});
 if(p.shape==='square'){line('south',[-1,-1],[1,-1]);line('east',[1,-1],[1,1]);line('north',[1,1],[-1,1]);line('west',[-1,1],[-1,-1]);}
 else if(p.shape==='trimmed'&&p.trim<1){const angle=Math.acos(p.trim),z=Math.sqrt(1-p.trim*p.trim);curve('north-arc',angle,Math.PI-angle,t=>[Math.cos(t),Math.sin(t)],'intact');curve('south-arc',Math.PI+angle,2*Math.PI-angle,t=>[Math.cos(t),Math.sin(t)],'intact');line('east-trim',[p.trim,-z],[p.trim,z]);line('west-trim',[-p.trim,z],[-p.trim,-z]);}
 else curve('perimeter',0,2*Math.PI,t=>t===0||t===2*Math.PI?[1,0]:[Math.cos(t),Math.sin(t)],'intact');
 if(p.damage){
  const edge=v=>.09+.055*Math.sin(v*17)+.017*Math.sin(v*53),top=u=>.13+.10*Math.sin(u*12);
  if(p.id%3===0){curve('loss-bank',-.31,1,v=>[edge(v),v]);line('loss-end',[edge(-.31),-.31],[1,-.31],'broken');}
  if(p.id%3===1){curve('loss-bank',-.43,1,u=>[u,top(u)]);line('loss-end',[-.43,top(-.43)],[-.43,1],'broken');}
  if(p.id%3===2)curve('loss-bank',-1,1,v=>[.20+.04*Math.sin(v*31)-.36*v,v]);
  for(const side of [-1,1]){curve('long-'+side,-1,1,v=>[-.27-.065*Math.sin(v*11)-.018*Math.sin(v*41)+side*.013,v]);curve('cross-'+side,-1,1,u=>[u,-.28-.052*Math.sin(u*17)-.011*Math.sin(u*57)+side*.009]);}
  for(let y=0;y<36;y++)for(let x=0;x<36;x++)if((x*13+y*7+p.id*11)%37===0){const a=(x+.21)/18-1,b=(x+.79)/18-1,c=(y+.16)/18-1,d=(y+.84)/18-1,id='hole-'+x+'-'+y;line(id+'-s',[a,c],[b,c],'broken');line(id+'-e',[b,c],[b,d],'broken');line(id+'-n',[b,d],[a,d],'broken');line(id+'-w',[a,d],[a,c],'broken');}
 }
 cache.set(key,out);return out;
}
function uvAt(s,p,position){const pos=[dot(position,p.right),dot(position,p.normal),dot(position,p.up)],r=len(p.center)*s.radius,f=(p.shape==='cap'||p.shape==='trimmed')?r/pos[1]:1;return [pos[0]*f/(p.size*(p.across||1)*s.radius),pos[2]*f/(p.size*s.radius)];}
function nearest(curve,uv,across=1){let best=Infinity,t=curve.lo;const distance=t=>{const q=curve.at(t);return ((q[0]-uv[0])*across)**2+(q[1]-uv[1])**2;},step=(curve.hi-curve.lo)/64;
 for(let i=0;i<=64;i++){const u=curve.lo+i*step,d=distance(u);if(d<best){best=d;t=u;}}
 let lo=Math.max(curve.lo,t-step),hi=Math.min(curve.hi,t+step);for(let i=0;i<40;i++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(distance(a)<distance(b))hi=b;else lo=a;}return (lo+hi)/2;
}
function frame(s,p,c,t){const uv=c.at(t),e=1e-7,a=c.at(t-e),b=c.at(t+e),d=[b[0]-a[0],b[1]-a[1]],n=norm([d[1],0,-d[0]]),epsilon=1e-12,left=solid(p,uv[0]+n[0]*epsilon,uv[1]+n[2]*epsilon),right=solid(p,uv[0]-n[0]*epsilon,uv[1]-n[2]*epsilon);
 if(left===right)return null;const side=left?1:-1,origin=E.canonicalPoint(s,p,...uv),up=p.shape==='cap'||p.shape==='trimmed'?mul(norm(origin),-1):[0,-1,0],tangent=norm(sub(E.canonicalPoint(s,p,...b),E.canonicalPoint(s,p,...a))),inward=norm(M.cross(up,tangent)),probe=E.canonicalPoint(s,p,uv[0]+n[0]*epsilon*side,uv[1]+n[2]*epsilon*side);
 return {uv,origin,up,inward:dot(sub(probe,origin),inward)>=0?inward:mul(inward,-1),tangent};
}
function candidates(s,range){if(!s.collection||s.layoutVersion!==2)return [];const result=[];
 for(const p of C.plates(s)){const r=len(p.center)*s.radius,curved=p.shape==='cap'||p.shape==='trimmed',plane=curved?Math.abs(len(s.position)-r):Math.abs(dot(s.position,p.normal)-r);if(plane>range+.2||dot(s.position,p.normal)<=0)continue;
  const uv=uvAt(s,p,s.position);if(Math.max(Math.abs(uv[0]),Math.abs(uv[1]))>1+range/(p.size*s.radius))continue;
  for(const c of curves(p)){const t=nearest(c,uv,p.across||1),point=E.plateVector(E.canonicalPoint(s,p,...c.at(t)),p),distance=len(sub(s.position,point));if(distance<range+2)result.push({p,c,t,distance});}
 }return result.sort((a,b)=>a.distance-b.distance);
}
// Intact visits use an actual perimeter. The historic strip followed a phantom
// fracture through the middle even when the parent had no damage at all.
function arrivalFrame(s,p){const preferred=p.damage?'long-1':p.shape==='square'?'east':p.shape==='trimmed'&&p.trim<1?'east-trim':'perimeter',c=curves(p).find(c=>c.id===preferred);
 const middle=preferred==='perimeter'?0:(c.lo+c.hi)/2;
 let f=frame(s,p,c,middle);for(let i=1;!f&&i<64;i++)f=frame(s,p,c,c.lo+(c.hi-c.lo)*i/64);
 if(!f)throw Error('No surviving Shade arrival boundary');
 return {...f,basis:[f.inward,f.up,norm(M.cross(f.inward,f.up))]};
}
function meshes(s,options={}){const out=[],modern=s.shadeGeometryRevision>=3,range=E.readableRange(.18,s)+Math.min(E.readableRange(.18,s),s._edgePrepareKm||0),fp=E.focal(s);
 for(const {p,c,t}of candidates(s,range*1.2)){const scale=p.size*s.radius*Math.max(1,p.across||1),step=3.2/scale,centre=Math.floor((t-c.lo)/step),count=Math.ceil(range*1.2/3.2)+2,total=Math.ceil((c.hi-c.lo)/step),closed=c.id==='perimeter';
  for(let address=closed?centre-count:Math.max(0,centre-count);address<=centre+count;address++){const j=closed?(address%total+total)%total:address,a=c.lo+j*step,b=Math.min(c.hi,c.lo+(j+1)*step);if(a>=c.hi)break;
   const mid=(a+b)/2,point=E.canonicalPoint(s,p,...c.at(mid)),world=E.plateVector(point,p),distance=len(sub(s.position,world));if(distance>range*1.2+4)continue;
   const fine=!options.coarse&&(options.fine||distance<.025*fp),lod=fine?'near':'far',key='shade:'+JSON.stringify([modern?3:2,p.id,s.radius,p.shape,p.across,p.damage,p.trim,c.id])+':'+j+':'+lod;
   const build=()=>{const f={origin:point,basis:[[1,0,0],[0,1,0],[0,0,1]]},mesh=new S.Mesh(point,f.basis,c.kind==='intact'?'Shade · finished perimeter':'Shade · broken structure');mesh.canonicalOrigin=point;mesh.canonicalBasis=f.basis;mesh.parentId=p.id;
    const contains=v=>{const q=add(point,v),r=len(p.center)*s.radius,ratio=p.shape==='cap'||p.shape==='trimmed'?r/q[1]:1,u=q[0]*ratio/(p.size*(p.across||1)*s.radius),v2=q[2]*ratio/(p.size*s.radius),e=1e-12;return solid(p,u,v2)||solid(p,u+e,v2)||solid(p,u-e,v2)||solid(p,u,v2+e)||solid(p,u,v2-e);};
    const raw=S.Mesh.prototype.tri;
    mesh.tri=function(a,b,c,colour,material=-1,emission=0){
     // A finished wall lies on/in the convex intact footprint by construction.
     // Only damage intersections and small fittings need polygon clipping.
     if(!p.damage&&material===-4){raw.call(this,a,b,c,colour,material,emission);return;}
     const input=[a,b,c],inside=input.map(contains);if(inside.every(Boolean)){raw.call(this,a,b,c,colour,material,emission);return;}if(inside.every(v=>!v))return;const polygon=[];
     for(let i=0;i<3;i++){const next=(i+1)%3;if(inside[i])polygon.push(input[i]);if(inside[i]!==inside[next]){let lo=0,hi=1;for(let k=0;k<40;k++){const t=(lo+hi)/2;if(contains(add(input[i],mul(sub(input[next],input[i]),t)))===inside[i])lo=t;else hi=t;}polygon.push(add(input[i],mul(sub(input[next],input[i]),(lo+hi)/2)));}}
     for(let i=1;i+1<polygon.length;i++)raw.call(this,polygon[0],polygon[i],polygon[i+1],colour,material,emission);
    };
    const vertex=(fr,x,y)=>sub(add(add(fr.origin,mul(fr.inward,x)),mul(fr.up,y)),point),n=modern||fine?16:4;
    // Shared parametric ticks and depth profiles at both LODs: only the small
    // braces change. Never move a chunk endpoint inward to sample its normal.
    const endpoint=(t,toward)=>{const f=frame(s,p,c,t);if(f)return f;const inside=frame(s,p,c,toward);return inside?{...inside,origin:E.canonicalPoint(s,p,...c.at(t))}:null;};
    // Clip each boundary interval against the combined predicate. At curve
    // intersections only a solid/void boundary survives; internal walls vanish.
    for(let i=0;i<n;i++){let lo=i===0?a:a+(b-a)*i/n,hi=i===n-1?b:a+(b-a)*(i+1)/n,fa=frame(s,p,c,lo),fb=frame(s,p,c,hi),fm=frame(s,p,c,(lo+hi)/2);if(!fa&&!fb&&!fm)continue;
     if(modern&&lo===c.lo&&fm)fa=endpoint(lo,(lo+hi)/2);if(modern&&hi===c.hi&&fm)fb=endpoint(hi,(lo+hi)/2);
     const transition=(invalid,valid)=>{for(let k=0;k<38;k++){const m=(invalid+valid)/2;if(frame(s,p,c,m))valid=m;else invalid=m;}return valid;};
     if(!fa){if(!fm&&!fb)continue;lo=transition(lo,fm?(lo+hi)/2:hi-1e-14);fa=frame(s,p,c,lo);}
     if(!fb){if(!fm&&!fa)continue;hi=transition(hi,fm?(lo+hi)/2:lo+1e-14);fb=frame(s,p,c,hi);}
     if(!fa||!fb||hi-lo<1e-15)continue;
     // Structural envelope is entirely on the solid side. An intact cap is
     // closed construction; breaks reveal layered faces and recessed braces.
     const strata=c.kind==='intact'?(modern?[0,-.02,-.055,-.125,-.16,-.18]:[0,-.18]):[0,-.025,-.075,-.145,-.18];
     // Flush caps at corners/intersections close recessed panels without
     // inventing a bevel across the neighbouring void. Both LODs agree here.
     const sealed=t=>modern&&((!closed&&(Math.abs(t-c.lo)<1e-13||Math.abs(t-c.hi)<1e-13))||!frame(s,p,c,t-1e-11)||!frame(s,p,c,t+1e-11))?0:1;
     const sa=sealed(lo),sb=sealed(hi),offset=k=>c.kind==='intact'?(modern?[0,0,.008,.008,0,0][k]:0):[0,0,.018,.01,0][k];
     for(let k=1;k<strata.length;k++){if(c.kind==='broken'&&(k===2||k===3))continue;const colour=c.kind==='intact'?(modern?[.09+k*.008,.11+k*.008,.13+k*.006]:[.12,.14,.15]):[.065+k*.008,.073+k*.008,.078+k*.008];mesh.quad(vertex(fa,offset(k-1)*sa,strata[k-1]),vertex(fb,offset(k-1)*sb,strata[k-1]),vertex(fb,offset(k)*sb,strata[k]),vertex(fa,offset(k)*sa,strata[k]),colour,-4);}
     if(c.kind==='broken'){mesh.quad(vertex(fa,.045*sa,-.025),vertex(fb,.045*sb,-.025),vertex(fb,.045*sb,-.145),vertex(fa,.045*sa,-.145),[.035,.042,.048],-4);if(modern){mesh.quad(vertex(fa,0,-.025),vertex(fb,0,-.025),vertex(fb,.045*sb,-.025),vertex(fa,.045*sa,-.025),[.07,.075,.08],-4);mesh.quad(vertex(fa,.045*sa,-.145),vertex(fb,.045*sb,-.145),vertex(fb,.01*sb,-.145),vertex(fa,.01*sa,-.145),[.055,.06,.065],-4);}if(fine){mesh.beam(vertex(fa,.012,-.026),vertex(fb,.012,-.145),.008,[.15,.13,.095]);mesh.beam(vertex(fa,.012,-.145),vertex(fb,.012,-.026),.008,[.12,.14,.15]);}}
     if(modern&&c.kind==='intact'&&fine){
      // Recessed expansion joints and vertical frame members, entirely inside
      // the perimeter envelope. Both analytic faces meet the full-depth cap.
      mesh.beam(vertex(fa,.006,-.025),vertex(fa,.006,-.155),.006,[.055,.065,.075]);
     }
    }
    delete mesh.tri;mesh.shadeRange=[a,b];mesh.boundaryId=c.id;mesh.lod=lod;mesh.sectionRevision=modern?3:2;return mesh.finish({deferBVH:true});};
   // The inexpensive envelope is available on the first visible frame. Fine
   // panels/braces can arrive asynchronously without exposing an empty edge.
   const mesh=E.remember(key,build,distance,distance<1||(modern&&options.coarse&&distance<E.readableRange(.18,s)*1.12));if(mesh&&mesh.count)out.push(E.transformMesh(mesh,p));
  }
 }return out;
}
root.SphereShadeEdges={curves,solid,frame,nearest,uvAt,candidates,arrivalFrame,meshes};
})(typeof window==='undefined'?globalThis:window);
