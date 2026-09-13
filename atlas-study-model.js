/* Authored atlas comparison model. This does not replace a saved Observatory layout. */
(function(root){
'use strict';
const M=root.SphereMath,W=root.SphereWorld,TAU=Math.PI*2;
const candidates=[
 {id:'current',name:'Current arrangement',tag:'Reference',description:'Continuous biome ribbons and repeated machinery. The reference against which the alternatives are judged.'},
 {id:'watershed',name:'Watershed network',tag:'Recommended',description:'Catchments organize planted ground. Water recovery and service centres gather beside receiving basins.'},
 {id:'compartment',name:'Compartmented habitat',tag:'Alternative B',description:'Independent habitat cells, clear service boundaries and controlled crossings between local water systems.'},
 {id:'backbone',name:'Industrial backbone',tag:'Alternative C',description:'Freight and maintenance corridors connect concentrated facilities, leaving larger tracts of open habitat.'}
];
const {noise,province}=root.SphereWatershedNetwork;
function address(s,region){
 if(region==='forest')return W.locateBiome(0,s);
 if(region==='industrial')return W.direction(M.radians(s.waistWidth+8),.3,s);
 if(region==='boundary')return W.direction(-M.radians(s.waistWidth)/3,-1,s);
 const index=region==='wound-a'?1:4,f=W.rimFrame(s,index,0);return M.norm(M.add(f.point,M.mul(f.inland,120/s.radius)));
}
const centreCache=new Map();
function cells(row,col){const key=row+':'+col;if(!centreCache.has(key)){const a=noise(row*7.31+31,col*2.91+17,823),b=noise(col*9.14+11,row*6.23+3,412);centreCache.set(key,{lat:(row+.2+a*.6)*.19-Math.PI/2,lon:(col+.2+b*.6)/16*TAU-Math.PI,family:10+Math.floor(a*3),tone:.80+b*.38});}return centreCache.get(key);}
function macro(candidate,lat,lon,s){
 const q=W.direction(lat,lon,s),width=M.radians(s.waistWidth),original=W.sample(q,{...s,multipleWounds:false});let color=original.color.slice(),region=original;
 if(candidate!=='current'&&Math.abs(lat)<1.31){
  if(Math.abs(lat)<width){
   let first=null,second=null;for(let row=0;row<3;row++)for(let j=0;j<10;j++){
    const jitter=candidate==='compartment'?0:.32*(noise(j*3.7,row*7.2,423)-.5),centreLat=-width+(row+.5+jitter)*width*2/3,centreLon=(W.fractions[j]+W.fractions[j+1])*.5*TAU-Math.PI,dx=Math.atan2(Math.sin(lon-centreLon),Math.cos(lon-centreLon))*Math.cos(lat),dy=(lat-centreLat)*2.5;
    const score=dx*dx+dy*dy,cell={score,id:W.provinces[row][j]};if(!first||score<first.score){second=first;first=cell;}else if(!second||score<second.score)second=cell;
   }
   const blend=candidate==='watershed'?.25*(1-W.smooth(0,.025,second.score-first.score)):0;color=W.palette[first.id].map((v,i)=>v*(1-blend)+W.palette[second.id][i]*blend);region={...original,id:first.id};
  }else{
   const row=Math.floor((lat+Math.PI/2)/.19),col=Math.floor((lon+Math.PI)/TAU*16);let best=null,distance=Infinity;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const cell=cells(row+dy,(col+dx+16)%16),dl=Math.atan2(Math.sin(lon-cell.lon),Math.cos(lon-cell.lon))*Math.cos(lat),dp=lat-cell.lat,score=dl*dl+dp*dp;if(score<distance){best=cell;distance=score;}}
   color=W.palette[best.family].map(v=>v*best.tone);region={...original,id:best.family};
  }
  if(candidate==='backbone'&&Math.abs(lat)<width&&Math.abs(Math.sin(lat*18+lon*.08))<.1)color=color.map((v,i)=>v*.3+W.palette[12][i]*.7);
 }
 return {color,missing:root.SphereCollection.missing(q,s),region};
}
root.SphereAtlasStudy={candidates,noise,province,address,macro};
})(typeof window==='undefined'?globalThis:window);
