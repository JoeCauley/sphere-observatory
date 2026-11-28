import {districtLocation,plantingDistance,stationHash,doorOffset} from '../../border-transport/0.10.0/district.mjs';

// Resolve roots in the small station chart before projecting to Meadow's AU-scale coordinates.
export function surveyVerge(row,district,meadow,owns){
  const {site}=row,side=site.address.plots.indexOf(meadow.plotId);
  if(side<0)return null;
  const hand=side===0?-1:1,hash=stationHash(site.address.key),door=site.x+doorOffset(hash,0),face=site.widthM*.5;
  const trees=[],beds=[],key=site.address.key+'/verge/'+side;
  const plant=(list,x,out,margin,properties)=>{
    const eastM=door+x,northM=hand*(face+out),g=districtLocation(district,eastM,northM);
    if(!owns(g)||plantingDistance(district,g.latitude,g.longitude)<margin)return null;
    const p={...row.at(eastM,northM),stationEastM:eastM,stationNorthM:northM,...properties};
    list.push(p);return p;
  };
  const homeX=-32-((hash>>>8)%8),homeOut=52+((hash>>>12)%13);
  const home=plant(trees,homeX,homeOut,9,{id:key+'/fork',heightM:15.5,radiusM:.71,phase:2.7,kind:0});
  const random=(i,j,k)=>stationHash([key,i,j,k].join('/'))/4294967296;
  for(let i=-3;i<4;i++)for(let j=0;j<4;j++){
    const x=(i+.15+.65*random(i,j,'x'))*55,out=(j+.35+.46*random(i,j,'z'))*62;
    if(random(i,j,'stand')>.52||Math.hypot(x-homeX,out-homeOut)<38||Math.abs(x)<18)continue;
    plant(trees,x,out,9,{id:key+'/tree/'+i+'/'+j,radiusM:.49,heightM:8+5*random(i,j,'height'),phase:6.28*random(i,j,'fork'),kind:1});
  }
  // Each drift has a planted ellipse, with flowers on long and short stems and gaps between clumps.
  function bed(x,out,spread,seed,species){
    return plant(beds,x,out,spread+1,{id:key+'/flowers/'+seed,spread,phase:6.28*random(seed,4,'petal'),species});
  }
  for(let i=0;i<15;i++){
    const x=homeX+4+6*Math.sin(i*1.67)+6*(random(i,2,'drift')-.5);
    const out=homeOut+19+(i-5)*2.3+4*Math.cos(i*2.36);
    bed(x,out,2.5+random(i,0,'width')*2,i,i%3);
  }
  for(let i=-3;i<4;i++)for(let j=0;j<3;j++){
    const x=(i+random(i,j,'wind'))*36,out=(j+.3+random(i,j,'soil'))*38;
    bed(x,out,4+2*random(i,j,'width'),30+(i+3)*3+j,(i+j+6)%3);
  }
  return home?{id:key,home,trees,beds,side:hand,door,face:face*hand,
    start:{eastM:home.stationEastM+2,northM:home.stationNorthM+hand*27,
      yaw:Math.atan2((door-home.stationEastM)*.33-2,hand*face*.33+home.stationNorthM*.67-(home.stationNorthM+hand*27)),pitch:.12,altitudeM:1.7,mode:'walk'}}:null;
}
