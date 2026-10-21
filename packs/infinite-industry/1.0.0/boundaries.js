// Flat-sided axial hexes in the shared shell-tangent metre frame.
export const EDGE_NORMALS=Array.from({length:6},(_,e)=>[Math.cos(e*Math.PI/3),Math.sin(e*Math.PI/3)]);
export const NEIGHBORS=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
export function hexCenter(q,r,width){return [width*(q+r*.5),width*Math.sqrt(3)*.5*r];}
export function rotateXZ(x,z,turns){const a=turns*Math.PI/3,c=Math.cos(a),s=Math.sin(a);return [c*x-s*z,s*x+c*z];}
export function worldEdge(localEdge,turns){return (localEdge+turns)%6;}
export function sharedBoundary(q,r,edge,{width=150,datum=48,seed=9187,revision='industry-hex-v1'}={}){
 if(!Number.isSafeInteger(q)||!Number.isSafeInteger(r)||!Number.isInteger(edge)||edge<0||edge>5||!Number.isFinite(width)||width<40||width>1000)throw Error('Invalid hex boundary');
 const [dq,dr]=NEIGHBORS[edge],neighbor=[q+dq,r+dr],pair=[[q,r],neighbor].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),canonicalEdge=pair[0][0]===q&&pair[0][1]===r?edge:(edge+3)%6;
 const a=hexCenter(...pair[0],width),b=hexCenter(...pair[1],width),normal=EDGE_NORMALS[canonicalEdge],center=[(a[0]+b[0])/2,datum,(a[1]+b[1])/2];
 return {schema:1,id:`${revision}:${seed}:${width}:${pair.map(v=>v.join(',')).join('|')}`,cells:pair,edgeIndex:canonicalEdge,type:'water-service-corridor',position:center,elevation:datum,width:6,clearance:4,orientation:Math.atan2(normal[1],normal[0]),normal:[normal[0],0,normal[1]],pedestrian:{width:4,elevation:datum,traversal:'walkable'},pipe:{offsetM:5,position:[center[0]-normal[1]*5,datum+5.6,center[2]+normal[0]*5],elevation:datum+5.6,radiusM:.6,medium:'water'},neighborRequirements:{type:'water-service-corridor',width:6,clearance:4,medium:'water',opposingFlow:true},traversal:'walkable',purpose:'Pedestrian inspection and continuous water transfer',authoritative:true};
}
export function facilityInterfaces(turns,options){const {q=0,r=0}=options.address??{};return Array.from({length:6},(_,edge)=>{const world=worldEdge(edge,turns),boundary=sharedBoundary(q,r,world,options);return {id:`facility:${q},${r}:edge:${edge}`,edgeIndex:edge,worldEdgeIndex:world,enabled:edge===0||edge===3,flow:edge===3?'intake':edge===0?'distribution':'reserved',boundary};});}
export function compatible(a,b){return a.boundary.id===b.boundary.id&&a.flow!==b.flow&&['intake','distribution'].includes(a.flow)&&['intake','distribution'].includes(b.flow);}
