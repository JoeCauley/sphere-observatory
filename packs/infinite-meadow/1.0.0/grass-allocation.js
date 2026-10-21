import {integerHash} from './grass-stage.js';

// Keep five canonical roots in each six-root group nearby; one in three in
// the wider, cheap geometry layer. Geographic ranks stay fixed as eyes move.
export function heroAllocation(roots,reach='wide'){
  if(!Number.isInteger(roots)||roots<0)throw RangeError('Invalid canonical root count');
  return reach==='wide'?{core:Math.floor(roots/6)*5+Math.max(0,roots%6-1),extension:Math.ceil(roots/3)}:{core:roots,extension:0};
}
export function heroRootIndex(index,tileSeed,roots,extension=false,reach='wide'){
  const count=heroAllocation(roots,reach)[extension?'extension':'core'];
  if(!Number.isInteger(index)||index<0||index>=count)throw RangeError('Invalid submitted root');
  if(reach!=='wide')return index;
  const size=extension?3:6,members=extension?1:5,group=Math.floor(index/members),member=index%members,available=Math.min(size,roots-group*size);
  const rank=integerHash(tileSeed^Math.imul(group,0x9e3779b9))%available;
  return group*size+(extension?rank:member+(member>=rank?1:0));
}
export const ALLOCATION_GLSL=`
int heroRootIndex(int index,uint tileSeed,int roots,bool wide,bool extension){
 if(!wide)return index;
 int size=extension?3:6,members=extension?1:5,group=index/members,member=index-group*members;
 int available=min(size,roots-group*size),rank=int(coverHash(tileSeed^uint(group)*0x9e3779b9u)%uint(available));
 return group*size+(extension?rank:member+(member>=rank?1:0));
}
`;
