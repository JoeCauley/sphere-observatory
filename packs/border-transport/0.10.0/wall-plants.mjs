import {hallHalfM,linkHalfM,stationHash,facadeRib} from './district.mjs';
import {ribSpacing} from '../../kit/outfall-wall.mjs';

// Only the nearby 216 metres of a jungle face need leaves with thickness.
// Roots belong to absolute wall chainage, so adjacent patches share their overlap.
const cellM=24;
export function plantPatch(s,d,eye,faces){
  if(!d || eye[1]<-4 || eye[1]>90)return null;
  const mid=s.widthM/2,side=eye[2]<mid?-1:1;
  if(faces[side<0?0:1]!==2)return null;
  const hall=Math.abs(eye[0])<hallHalfM,along=s.address.chainageM+eye[0];
  if(!hall && (along<d.sites[0].x || along>d.sites.at(-1).x))return null;
  const wall=mid+side*(hall?mid:linkHalfM);
  const outside=side*(eye[2]-wall);
  if(outside<0 || outside>95)return null;
  const cell=Math.floor(along/cellM);
  return {cell,wall,side,hall,key:[s.address.key,hall,side,cell].join('/')};
}

export function growWallPlants(mesh,s,d,patch){
  const {cell,wall,side,hall}=patch,offset=s.address.chainageM;
  for(let i=cell-4;i<=cell+4;i++){
    let seed=stationHash([s.address.world,...s.address.plots,side,i].join('/'));
    const sample=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let plant=0;plant<3;plant++){
      const root=(i+(plant+sample())/3)*cellM-offset;
      if(hall!== (Math.abs(root)<hallHalfM-4))continue;
      if(!hall && (offset+root<d.sites[0].x || offset+root>d.sites.at(-1).x))continue;
      if(hall && s.routes.some(r=>Math.abs(root-r.nearDoor[0])<r.door[0]*.5+4))continue;
      const bay=Math.round(root/ribSpacing);
      if(hall && Math.abs(root-bay*ribSpacing)<2.5 && facadeRib(s,bay))continue;
      const height=3.5+28*sample()**1.8,phase=sample()*6.2832,wave=.8+sample()*2;
      const color=[.18,.37+.20*sample(),.15],shade=color.map(c=>c*.70);
      const stem=[.24,.28,.115],width=.045+.05*sample();
      let prev=[root,0,wall+side*1.08];
      for(let y=.70;y<=height;y+=.70){
        const x=root+.47*Math.sin(y*.32+phase)+.31*Math.sin(y*.80+phase*2);
        const z=wall+side*(1.16+.09*Math.sin(y*.76+phase));
        mesh.quad([prev[0]-width,prev[1],prev[2]],[x-width,y,z],[x+width,y,z],[prev[0]+width,prev[1],prev[2]],stem);
        const dir=sample()<.5?-1:1,len=(.45+.82*sample())*wave;
        const end=[x+dir*len,y+.06+len*.15,z+side*(.30+len*.28)];
        const middle=[x+dir*len*.45,y+len*.21,z+side*(.35+len*.22)];
        // Two folded blades meet along a raised midrib and turn away from the concrete.
        mesh.quad([x,y,z],[middle[0],middle[1]+len*.18,middle[2]-side*.16],end,middle,color);
        mesh.quad([x,y,z],middle,end,[middle[0],middle[1]-len*.23,middle[2]+side*.08],shade);
        prev=[x,y,z];
      }
    }
  }
}
