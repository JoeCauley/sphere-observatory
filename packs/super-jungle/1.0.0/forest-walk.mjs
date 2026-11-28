import {plantingDistance,stationHash} from '../../border-transport/0.10.0/district.mjs';
// Survey the same 128 m shell lattice used by the native forest.
import {project,unproject} from '../../kit/surface-route.js';
function findWindthrow(state,o,host,safe){
  const W=host.SphereWorld,M=host.SphereMath,S=host.SphereSites,r=state.radius,R=r*1000;
  const t=o.tree.local,g=o.gap.local;
  const threshold=o.threshold&&project(o,o.threshold.latitude,o.threshold.longitude,R);
  const direction=threshold?[-threshold.eastM,-threshold.northM]:[t.eastM-g.eastM,t.northM-g.northM];
  const norm=Math.hypot(...direction);const ex=direction[0]/norm,ez=direction[1]/norm;
  const aim=[t.eastM+1000*ex,t.northM+1000*ez];
  const biome=q=>host.SphereGeography?.query(q,{state,representation:"walking"}).biome??W.sample(q,state).biome;
  const qAt=(x,z)=>{const u=unproject(o,x,z,R);return W.direction(u.latitude,u.longitude,state);};
  const corners=[];for(const a of [-320,320])for(const b of [-320,320])corners.push(M.mul(qAt(aim[0]+a,aim[1]+b),r));
  const bounds=[0,1,2].map(i=>[Math.floor(Math.min(...corners.map(p=>p[i]))/.128)-1,Math.floor(Math.max(...corners.map(p=>p[i]))/.128)+1]);
  const live=[],vacant=[];
  for(let i=bounds[0][0];i<=bounds[0][1];i++)for(let j=bounds[1][0];j<=bounds[1][1];j++)for(let k=bounds[2][0];k<=bounds[2][1];k++){
    const lattice=[i,j,k].map(v=>(v+.5)*.128);
    if(Math.abs(M.length(lattice)-r)>.055)continue;
    const q=M.norm(lattice),ll=W.coordinates(q,state),local=project(o,ll.lat,ll.lon,R);
    const p={q,local,i,j,k,latitude:ll.lat,longitude:ll.lon};
    const density=S.noise(i,j,state.seed+k);
    if(density<=.64){live.push({...p,radiusM:(13+12*S.noise(i,k,state.seed+j))*1.55});continue;}
    const range=Math.hypot(local.eastM-t.eastM,local.northM-t.northM);
    if(range<830||range>1130||Math.hypot(local.eastM-aim[0],local.northM-aim[1])>215)continue;
    if(M.inBreach(q,state)||host.SphereCollection.missing(q,state)||biome(q)!==1)continue;
    if(safe&&!safe(ll,65))continue;
    vacant.push({...p,range});
  }
  let best=null;
  for(const p of vacant){
    const x=p.local.eastM,z=p.local.northM;
    for(let turn=0;turn<8;turn++){
      const angle=(turn+S.noise(p.k,p.i,state.seed+p.j))*Math.PI/4;
      const dx=Math.cos(angle),dz=Math.sin(angle),lengthM=47+12*S.noise(p.i,p.k,state.seed+p.j+61);
      const nearest=Math.min(200,...live.map(v=>{
        const a=v.local.eastM-x,b=v.local.northM-z,along=Math.max(0,Math.min(lengthM,a*dx+b*dz));
        return Math.hypot(a-along*dx,b-along*dz)-v.radiusM;
      }));
      if(nearest<20)continue;
      const elevation=(x,z)=>{const q=qAt(x,z);return host.SphereGround.geographic(q,state)*1000;};
      const tipQ=qAt(x+dx*lengthM,z+dz*lengthM);
      if(!safe(W.coordinates(tipQ,state),12)||M.inBreach(tipQ,state)||host.SphereCollection.missing(tipQ,state)||biome(tipQ)!==1)continue;
      const rise=Math.abs(elevation(x,z)-elevation(x+dx*lengthM,z+dz*lengthM));
      if(rise>4)continue;
      const score=Math.hypot(x-aim[0],z-aim[1])+.4*Math.abs(p.range-1000)-.15*Math.min(100,nearest)+rise;
      if(!best||score<best.score)best={score,id:['windthrow',state.seed,p.i,p.j,p.k].join(':'),latitude:p.latitude,longitude:p.longitude,
        local:{...p.local},tip:unproject(o,x+lengthM*dx,z+lengthM*dz,R),direction:p.q,angle,lengthM,clearanceM:nearest,distanceM:p.range,reliefM:rise};
    }
  }
  return best;
}

export function surveyForestWalk(state,occurrence,host=globalThis,district=null){
  const {SphereWorld:W,SphereMath:M}=host;
  const safe=(ll,radius)=>!district||plantingDistance(district,ll.lat,ll.lon)>radius+2;
  const fall=findWindthrow(state,occurrence,host,safe);
  if(!fall)return null;
  const R=state.radius*1000,t=occurrence.tree.local,g=occurrence.gap.local,f=fall.local;
  const qAt=(x,z)=>{const ll=unproject(occurrence,x,z,R);return W.direction(ll.latitude,ll.longitude,state);};
  const point=(x,z)=>({local:{eastM:x,northM:z},q:qAt(x,z)});
  const tip=project(occurrence,fall.tip.latitude,fall.tip.longitude,R);
  const course=[f.eastM-t.eastM,f.northM-t.northM],length=Math.hypot(...course);
  const along=[course[0]/length,course[1]/length],across=[-along[1],along[0]];
  const trees=[],ferns=[];
  // Address planting cells in the occurrence chart. Geographic roots survive terrain rebases.
  const salt=stationHash(occurrence.tree.id),cellM=48;
  const distanceTo=(x,z,a,b)=>{
    const dx=b.eastM-a.eastM,dz=b.northM-a.northM;
    const u=Math.max(0,Math.min(1,((x-a.eastM)*dx+(z-a.northM)*dz)/(dx*dx+dz*dz)));
    return Math.hypot(x-a.eastM-u*dx,z-a.northM-u*dz);
  };
  const lowX=Math.floor((Math.min(t.eastM,f.eastM)-175)/cellM),highX=Math.ceil((Math.max(t.eastM,f.eastM)+175)/cellM);
  const lowZ=Math.floor((Math.min(t.northM,f.northM)-175)/cellM),highZ=Math.ceil((Math.max(t.northM,f.northM)+175)/cellM);
  const allow=(x,z,r)=>{const q=qAt(x,z),ll=W.coordinates(q,state);return safe(ll,r)&&!M.inBreach(q,state)&&
    !host.SphereCollection.missing(q,state)&&(host.SphereGeography?.query(q,{state,representation:'walking'}).biome??W.sample(q,state).biome)===1;};
  for(let i=lowX;i<=highX;i++)for(let j=lowZ;j<=highZ;j++){
    const rnd=k=>stationHash([salt,i,j,k].join('/'))/4294967296;
    const x=(i+.13+.74*rnd('east'))*cellM,z=(j+.13+.74*rnd('north'))*cellM;
    const longitudinal=(x-t.eastM)*along[0]+(z-t.northM)*along[1];
    const transverse=(x-t.eastM)*across[0]+(z-t.northM)*across[1];
    if(distanceTo(x,z,t,f)>145+20*Math.sin(longitudinal/108)||distanceTo(x,z,f,tip)<30||
       distanceTo(x,z,g,t)<43)continue;
    const ribbon=9*Math.sin(longitudinal/120);
    if(Math.abs(transverse-ribbon)<13||rnd('thin')<.16||!allow(x,z,16))continue;
    trees.push({...point(x,z),id:occurrence.tree.id+'/stand/'+i+'/'+j,heightM:19+20*rnd('height'),radiusM:9+9*rnd('spread'),
      phase:rnd('fork')*Math.PI*2,tint:rnd('green')});
  }
  // Low ferns follow the damp margin. Space between fans leaves room to turn around on foot.
  for(let i=0;i<Math.ceil(length/17);i++){
    const rnd=k=>stationHash([salt,'fern',i,k].join('/'))/4294967296,d=(i+.2+.6*rnd('step'))*17;
    const side=(i%2?1:-1)*(4+5*rnd('edge'))+9*Math.sin(d/120);
    const x=t.eastM+d*along[0]+side*across[0],z=t.northM+d*along[1]+side*across[1];
    if(!allow(x,z,2)||Math.hypot(x-t.eastM,z-t.northM)<26||distanceTo(x,z,f,tip)<12)continue;
    ferns.push({...point(x,z),phase:2*Math.PI*rnd('fan'),sizeM:1.1+1.1*rnd('size')});
  }
  return {id:fall.id,anchor:qAt(t.eastM,t.northM),fallen:{...fall,tipQ:qAt(tip.eastM,tip.northM)},trees,ferns,
    buttress:{...occurrence.tree,q:qAt(t.eastM,t.northM),phase:(occurrence.tree.radiusM-13)/12*Math.PI*2},
    gap:occurrence.gap.local};
}
