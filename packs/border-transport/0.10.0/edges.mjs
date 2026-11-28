// Canonical shared intervals of the Atlas plot grid. Angles are in the Atlas
// frame. A meridian increases northward and a parallel increases eastward.
if(!globalThis.SphereAtlas)await import('../../../sphere-atlas.js');
const atlas=globalThis.SphereAtlas, tau=2*Math.PI;
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
const lonAt=(col,n)=>col*tau/n-Math.PI;
const rowAt=row=>row*atlas.ROW-atlas.LIMIT;
const mod=(i,n)=>(i%n+n)%n;

export function sharedEdge(first,second,radiusM){
  const [a,b]=[atlas.byId(first),atlas.byId(second)].sort((p,q)=>(p?.index??-1)-(q?.index??-1));
  if(!a||!b||a.id===b.id||!(radiusM>0))throw Error('Two adjacent Atlas plots and a positive radius are required');
  const plots=[a.id,b.id],id=plots.join('/');let latitude,longitude,axis,lengthM,acrossSign=1;
  if(a.row===b.row){
    const step=b.col-a.col;
    if(step!==1&&step!==a.columns-1)throw Error('Plots do not share an edge');
    acrossSign=step===1?1:-1; axis='meridian';
    latitude=a.latitude;longitude=wrap(lonAt(a.col+(acrossSign===1?1:0),a.columns));
    lengthM=atlas.ROW*radiusM;
  }else{
    if(b.row!==a.row+1)throw Error('Plots do not share an edge');
    const lo=Math.max(a.col/a.columns,b.col/b.columns),hi=Math.min((a.col+1)/a.columns,(b.col+1)/b.columns);
    if(hi-lo<=1e-12)throw Error('Plots do not share a traversable edge');
    latitude=rowAt(b.row);longitude=(lo+hi)*Math.PI-Math.PI;axis='parallel';
    lengthM=(hi-lo)*tau*Math.cos(latitude)*radiusM;
  }
  return {id,plots,axis,acrossSign,latitude,longitude,lengthM,radiusM};
}

function polarEdge(plot,north,radiusM){
  const latitude=north?atlas.LIMIT:-atlas.LIMIT,plots=[plot.id,north?'polar-north':'polar-south'];
  return {id:plots.join('/'),plots,axis:'parallel',acrossSign:1,latitude,longitude:plot.longitude,
    lengthM:tau/plot.columns*Math.cos(latitude)*radiusM,radiusM};
}

// At a grid vertex the canonical ID breaks an equal-distance tie. The other
// arms remain in the visible neighbourhood and contribute to the same roof.
export function edgeCoordinates(edge,lat,lon){
  const {latitude,longitude,radiusM:r}=edge,dl=wrap(lon-longitude);
  const parallel=edge.axis==='parallel';
  const alongM=parallel?dl*Math.cos(latitude)*r:(lat-latitude)*r;
  const acrossM=parallel?(lat-latitude)*r:dl*Math.cos(lat)*r*edge.acrossSign;
  return {alongM,acrossM,distanceM:Math.hypot(Math.max(0,Math.abs(alongM)-edge.lengthM/2),acrossM)};
}
function parallels(plot,north,r){
  const other=plot.row+(north?1:-1);
  if(other<0||other>=atlas.ROWS)return [polarEdge(plot,north,r)];
  const n=atlas.columns(other),lo=Math.floor(plot.col*n/plot.columns),hi=Math.ceil((plot.col+1)*n/plot.columns)-1;
  const edges=[];
  for(let j=lo;j<=hi;j++)edges.push(sharedEdge(plot.id,'r'+other+'c'+j,r));
  return edges;
}
export function edgesOf(plot,r){
  const sibling=j=>'r'+plot.row+'c'+mod(j,plot.columns);
  return [sharedEdge(plot.id,sibling(plot.col-1),r),sharedEdge(plot.id,sibling(plot.col+1),r),
    ...parallels(plot,false,r),...parallels(plot,true,r)];
}
export function addressAt(lat,lon,r){
  const limit=atlas.LIMIT;
  const p=atlas.plotAt(Math.max(-limit+1e-10,Math.min(limit-1e-10,lat)),wrap(lon));
  const edges=Math.abs(lat)>=limit?[polarEdge(p,lat>0,r)]:edgesOf(p,r);
  let best;
  for(const edge of edges){
    const coord=edgeCoordinates(edge,lat,lon);
    if(!best||coord.distanceM<best.distanceM-.0001||
       (Math.abs(coord.distanceM-best.distanceM)<=.0001&&edge.id<best.edge.id))best={edge,...coord};
  }
  return best;
}

// Constant-time distance for movement and broad phase. Outside a parcel the
// closest grid line always bounds the parcel occupied by the sample point.
export function gridDistance(lat,lon,r){
  if(Math.abs(lat)>=atlas.LIMIT)return (Math.abs(lat)-atlas.LIMIT)*r;
  const rowF=(lat+atlas.LIMIT)/atlas.ROW,cols=atlas.columns(Math.min(atlas.ROWS-1,Math.floor(rowF)));
  const colF=(lon+Math.PI)*cols/tau;
  return Math.min(Math.abs(rowF-Math.round(rowF))*atlas.ROW,Math.abs(colF-Math.round(colF))*tau/cols*Math.cos(lat))*r;
}

export function nearbyEdges(lat,lon,r,reach){
  // Bound the number of parcels even in miniature study worlds.
  const step=Math.min(reach/r,atlas.ROW*.45),lo=lat-step,hi=lat+step;
  const first=Math.max(0,Math.floor((lo+atlas.LIMIT)/atlas.ROW)),last=Math.min(atlas.ROWS-1,Math.floor((hi+atlas.LIMIT)/atlas.ROW));
  const result=new Map();
  for(let row=first;row<=last;row++){
    const cols=atlas.columns(row),delta=step/Math.max(.15,Math.cos(Math.min(atlas.LIMIT,Math.abs(lat)+step)));
    const left=Math.floor((lon-delta+Math.PI)*cols/tau),right=Math.floor((lon+delta+Math.PI)*cols/tau);
    for(let c=left;c<=right;c++){
      const p=atlas.byId('r'+row+'c'+mod(c,cols));
      for(const edge of edgesOf(p,r))if(!result.has(edge.id)&&edgeCoordinates(edge,lat,lon).distanceM<=reach)
        result.set(edge.id,edge);
    }
  }
  return [...result.values()];
}

export function pointOnEdge(edge,along,across=0){
  const r=edge.radiusM;
  if(edge.axis==='parallel')return {latitude:edge.latitude+across/r,longitude:wrap(edge.longitude+along/(r*Math.cos(edge.latitude)))};
  const latitude=edge.latitude+along/r;
  return {latitude,longitude:wrap(edge.longitude+edge.acrossSign*across/(r*Math.cos(latitude)))};
}
export function meetsMeridian(edge,side,end){
  const p=atlas.byId(edge.plots[side]);if(!p)return false;
  const {longitude}=pointOnEdge(edge,end*edge.lengthM/2);
  const column=(longitude+Math.PI)/tau*p.columns;
  return Math.abs(column-Math.round(column))<1e-8;
}
