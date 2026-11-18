import {hash32} from '../../infinite-meadow/1.0.0/coordinates.js';
import {facilityInterfaces,rotateXZ,hexCenter} from './boundaries.js';
export const SEED=9187,WIDTH_M=150,DATUM_M=48,GEOGRAPHY='industry-water-v1',ART='builder-water-v1';
export const ZONES=[{id:'yard',center:[0,48],radius:72},{id:'hall',center:[0,-6],radius:43},{id:'intake',center:[-43,0],radius:37},{id:'gallery',center:[24,2],radius:35},{id:'storage',center:[42,-11],radius:33},{id:'connections',center:[0,0],radius:108}];
export function selection(seed=SEED,address={q:0,r:0},overrides={}){
 const key=`${GEOGRAPHY}:${seed}:${address.q},${address.r}`,pick=name=>hash32(`${key}:${name}`);
 return {schema:1,seed,address:{...address},geographyRevision:GEOGRAPHY,artRevision:ART,acrossFlatsM:overrides.acrossFlatsM??WIDTH_M,orientation:overrides.orientation??pick('orientation')%6,model:overrides.model??pick('model')%2,treatment:overrides.treatment??pick('treatment')%2,connectionLayout:0,grammar:{orientations:6,supportRolePermutations:720,facilityModels:5,bigPlantModels:5,textureTreatments:10,connectionLayouts:5},implemented:{models:2,treatments:2,connections:2}};
}
export function processGraph(){return {nodes:[{id:'intake',position:[-43,0],function:'Receiving and screening raw water'},{id:'treatment',position:[0,-6],function:'Clarification and pressure filtration'},{id:'storage',position:[42,-11],function:'Buffering treated water'},{id:'distribution',position:[75,0],function:'Delivery to the pod'},{id:'recovery',position:[42,42],function:'Returning diverted water to the intake'}],links:[{from:'intake',to:'treatment',route:[[-75,5.6,5],[-60,5.6,5],[-60,5.6,-15],[-43,5.6,-15],[-26,5.6,-15],[-10,5.6,-15]]},{from:'treatment',to:'storage',route:[[10,5.6,-18],[27,5.6,-18],[42,5.6,-18]]},{from:'storage',to:'distribution',route:[[42,5.6,6],[55,5.6,6],[55,5.6,5],[75,5.6,5]]},{from:'treatment',to:'recovery',route:[[10,2.5,14],[42,2.5,14],[42,2.5,42]],activeWhen:'recovery'},{from:'recovery',to:'intake',route:[[42,2.5,42],[42,5.6,42],[42,5.6,54],[-60,5.6,54],[-60,5.6,13],[-43,5.6,13]],activeWhen:'recovery'}]};}
export function createFacility(config=selection()){
 const scale=config.acrossFlatsM/WIDTH_M,center=hexCenter(config.address.q,config.address.r,config.acrossFlatsM),toWorld=(x,z)=>rotateXZ(x*scale,z*scale,config.orientation).map((v,i)=>v+center[i]),toLocal=(x,z)=>rotateXZ((x-center[0])/scale,(z-center[1])/scale,-config.orientation);
 const interfaces=facilityInterfaces(config.orientation,{width:config.acrossFlatsM,datum:DATUM_M,seed:config.seed,address:config.address});
 const solids=[];const box=(x,z,hx,hz,height,id)=>solids.push({kind:'box',x,z,hx,hz,bottom:0,top:height,id});const cylinder=(x,z,r,h,id)=>solids.push({kind:'cylinder',x,z,r,bottom:0,top:h,id});
 for(const z of [-21,-3,15])for(const x of [-10,10])cylinder(x,z,3.3,11,`filter:${x}:${z}`);
 for(const z of [-15,13])cylinder(-43,z,10.4,3.8,'clarifier');for(const z of [-22,6])cylinder(42,z,8.3,21,'storage');
 // Hall sides with entrances left genuinely open. Roof stops ascending flight.
 for(const x of [-19,19])for(const z of [-29,-17,-5,7,19])box(x,z,.5,.5,22,'hall-column');
 box(0,-35,19,.5,20,'hall-back');box(0,-6,19,28.5,1,'roof');solids.at(-1).bottom=22;solids.at(-1).top=25;
 box(42,42,9.5,6.5,1.7,'recovery-basin');box(4,14,.7,.55,1.3,'valve-plinth');
 // Rails are solid but do not close either ramp landing or the gallery link.
 for(const x of [22.8,29.2]){box(x,14,.11,18,10,'ramp-rail');solids.at(-1).rampRail=true;}
 for(const x of [11,18.7])for(const [z,hz] of [[-18,10],[12,8]]){box(x,z,.10,hz,10.1,'gallery-rail');solids.at(-1).bottom=9;}
 const support=(east,north,foot=0)=>{const [x,z]=toLocal(east,north);let h=0;
  if(x>=23&&x<=29&&z>=-4&&z<=32){const ramp=9*(32-z)/36;if(foot>=DATUM_M+ramp-.23)h=ramp;}
  if(x>=11&&x<=29&&z>=-8&&z<=-4&&foot>=DATUM_M+8.5)h=9;
  if(x>=11&&x<=19&&z>=-29&&z<=20&&foot>=DATUM_M+8.5)h=9;
  return DATUM_M+h;
 };
 const blocked=(east,north,eye,walking)=>{const [x,z]=toLocal(east,north),feet=eye-DATUM_M-1.7;
  const floorBlocked=h=>feet+1.65>=h-.18&&feet<h-.001&&!(walking&&h-feet<=.23);
  if(x>=23&&x<=29&&z>=-4&&z<=32&&floorBlocked(9*(32-z)/36))return true;
  if((x>=11&&x<=19&&z>=-29&&z<=20||x>=11&&x<=29&&z>=-8&&z<=-4)&&floorBlocked(9))return true;
  for(const link of process.links)for(let i=1;i<link.route.length;i++){const a=link.route[i-1],b=link.route[i],d=b.map((v,k)=>v-a[k]),den=d[0]**2+d[2]**2,t=den?Math.max(0,Math.min(1,((x-a[0])*d[0]+(z-a[2])*d[2])/den)):0,y=a[1]+d[1]*t,r=link.activeWhen?.35:.6;
   const low=den?y:Math.min(a[1],b[1]),high=den?y:Math.max(a[1],b[1]);if(feet+1.65>=low-r&&feet<=high+r&&Math.hypot(x-a[0]-d[0]*t,z-a[2]-d[2]*t)<r+.3)return true;}
  return solids.some(s=>{if(s.rampRail){const ramp=9*Math.max(0,Math.min(1,(32-z)/36));if(feet<ramp-.1||feet>ramp+1.1)return false;}else if(feet+1.65<s.bottom||feet>s.top)return false;return s.kind==='cylinder'?Math.hypot(x-s.x,z-s.z)<s.r+.30:x>s.x-s.hx-.30&&x<s.x+s.hx+.30&&z>s.z-s.hz-.30&&z<s.z+s.hz+.30;});
 };
 const process=processGraph(),arrival=toWorld(0,64),control=toWorld(4,14);
 for(const edge of [3,0]){const boundary=interfaces[edge].boundary,[x,z]=toLocal(boundary.pipe.position[0],boundary.pipe.position[2]),port=[x,5.6,z];if(edge===3)process.links[0].route.splice(0,1,port,[-60,5.6,z]);else process.links[2].route.splice(-1,1,[75,5.6,6],port);}
 const rackSupports=[];for(const link of process.links)for(let i=1;i<link.route.length;i++){const a=link.route[i-1],b=link.route[i],d=b.map((v,k)=>v-a[k]),l=Math.hypot(...d);for(let t=2;t<l;t+=6){const p=a.map((v,k)=>v+d[k]*t/l);if(p[1]>4&&!(Math.abs(p[0])<3&&p[2]>22)){rackSupports.push(p);box(p[0],p[2],.16,.16,p[1]-.6,'pipe-rack-column');}}}
 return {config,center,process,interfaces,solids,rackSupports,toWorld,toLocal,support,blocked,arrival:{eastM:arrival[0],northM:arrival[1],altitudeM:DATUM_M+1.7,yaw:config.orientation*Math.PI/3,pitch:.04,mode:'walk'},control:{eastM:control[0],northM:control[1],radiusM:3.6},zones:ZONES.map(z=>({...z,worldCenter:toWorld(...z.center)}))};
}
