import {hash32,clamp} from './coordinates.js';

// A cover profile supplies proportions, density and wind, independently of the
// terrain adapter. The distant cards and near blades use the same wind kernel.
export const COVER_PROFILES=Object.freeze({
  full:Object.freeze({id:'short-9',tufts:2304,height:[.42,.80],width:[.018,.038],bend:.34}),
  dense:Object.freeze({id:'short-16',tufts:4096,height:[.42,.80],width:[.018,.038],bend:.34}),
  lush:Object.freeze({id:'tall-24',tufts:6144,height:[1.04,1.65],width:[.045,.075],bend:.44})
});
export const STAGE=Object.freeze({tileM:16,tileRadius:4,maxTiles:81,nearFade:[24,64],innerFade:[22,32],originalFade:[22,32],
  boxTiers:[{pitch:1.4,grid:128,blades:72,fade:[14,44,36,84]},{pitch:2.8,grid:128,blades:48,fade:[36,84,88,170]},{pitch:5.6,grid:128,blades:24,fade:[88,170,170,348]}],
  groundCoverFade:[20,22000]});
export function profileFor(density,heightScale=1,widthScale=1){const p=COVER_PROFILES[density]??COVER_PROFILES.lush;
  return heightScale===1&&widthScale===1?p:{...p,height:p.height.map(v=>v*heightScale),width:p.width.map(v=>v*widthScale)};}
const TAU=Math.PI*2,phase=value=>((value%TAU)+TAU)%TAU;
export function transitionPhases(east,north){return [phase(east*.017+north*.011),phase(-east*.009+north*.023),phase(east*.043-north*.029),phase(-east*.031-north*.037)];}
export function transitionField(east,north){const p=transitionPhases(east,north);return .50*Math.sin(p[0])+.27*Math.sin(p[1])+.15*Math.sin(p[2])+.08*Math.sin(p[3]);}
export function transitionBlend(distance,east,north,start,end){
  const width=end-start,smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
  const gate=smooth(start,start+width*.25,distance)*(1-smooth(end-width*.25,end,distance));
  return smooth(start,end,distance+width*.16*transitionField(east,north)*gate);
}
export const TRANSITION_GLSL=`
uniform vec4 uTransitionPhase;
float coverTransitionField(vec2 at){return .50*sin(uTransitionPhase.x+dot(at,vec2(.017,.011)))
  +.27*sin(uTransitionPhase.y+dot(at,vec2(-.009,.023)))
  +.15*sin(uTransitionPhase.z+dot(at,vec2(.043,-.029)))
  +.08*sin(uTransitionPhase.w+dot(at,vec2(-.031,-.037)));}
// The warp vanishes at both endpoints, keeping every band within its footprint.
float coverBlend(vec2 at,float start,float end){float d=length(at),width=end-start;
  float gate=smoothstep(start,start+width*.25,d)*(1.-smoothstep(end-width*.25,end,d));
  return smoothstep(start,end,d+width*.16*coverTransitionField(at)*gate);}
`;
export function windUniforms(state){
  const p=state.pose,t=state.windTime;
  return {spatial:[phase(p.eastM*.045+p.northM*.032),phase(p.eastM*.021-p.northM*.058)],micro:phase(p.eastM*.22+p.northM*.15),
    temporal:[phase(t*.95),phase(t*.63),phase(t*2.4)]};
}
export function windAt(east,north,time,height=1,amount=.44){
  const wave=Math.sin(east*.045+north*.032+time*.95)+.46*Math.sin(east*.021-north*.058-time*.63);
  const bend=(.18+wave*.43)*height*amount;
  return [.85328183365*bend,.52145000945*bend];
}
export const WIND_GLSL=`
uniform vec2 uWindPhase;uniform vec3 uWindTime;uniform float uBend,uWindMicroPhase;
float coverWave(vec2 at){return sin(uWindPhase.x+dot(at,vec2(.045,.032))+uWindTime.x)
  +.46*sin(uWindPhase.y+dot(at,vec2(.021,-.058))-uWindTime.y);}
vec2 coverWind(vec2 at,float y,float h){return vec2(.8532818,.5214500)*(.18+coverWave(at)*.43)*h*uBend*y*y;}
`;
export const HASH_GLSL=`
uint coverHash(uint x){x^=x>>16u;x*=0x7feb352du;x^=x>>15u;x*=0x846ca68bu;return x^(x>>16u);}
float coverRandom(uint x){return float(coverHash(x))/4294967296.;}
`;
export function integerHash(value){let x=value>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);return (x^(x>>>16))>>>0;}
export function splitCell(value){const high=Math.floor(value/4294967296);return {low:(value-high*4294967296)>>>0,high:high>>>0};}
// Small CPU reference for anchoring checks; runtime never materializes root arrays.
export function rootAt(tile,index,density='lush'){
  const count=profileFor(density).tufts;if(index<0||index>=count)throw RangeError('Root index outside tile');
  const seed=integerHash(tile.seed^Math.imul(index,0x9e3779b9)),random=n=>integerHash((seed+n)>>>0)/4294967296;
  const columns=Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/columns);
  return {eastM:tile.tx*16+(index%columns+.15+.7*random(1))*16/columns,northM:tile.tz*16+(Math.floor(index/columns)+.15+.7*random(2))*16/rows,seed};
}

export class GrassStage {
  constructor({ground=()=>12}={}){this.ground=ground;this.tiles=new Map;this.required=[];this.version=0;this.demandKey='';this.generated=0;this.evicted=0;this.ready=false;this.failure=null;}
  update(p,density='lush',reach='wide'){
    const active=p.altitudeM-this.ground(p.eastM,p.northM)-1.7<140;
    const tx=Math.floor(p.eastM/16),tz=Math.floor(p.northM/16),profile=profileFor(density),radius=reach==='wide'?STAGE.tileRadius:2,key=active?`${tx}/${tz}/${profile.id}/${reach}`:'coarse';
    if(key===this.demandKey)return false;
    this.demandKey=key;this.version++;this.required=[];
    this.reach=reach;this.center={tx,tz};
    if(active)for(let z=tz-radius;z<=tz+radius;z++)for(let x=tx-radius;x<=tx+radius;x++)this.required.push(`cover-v04:713:${profile.id}:16m:${x}:${z}`);
    const desired=new Set(this.required);
    for(const k of this.tiles.keys())if(!desired.has(k)){this.tiles.delete(k);this.evicted++;}
    for(const k of this.required)if(!this.tiles.has(k)){
      const parts=k.split(':'),x=Number(parts.at(-2)),z=Number(parts.at(-1)),seed=hash32(`cover-v04:713:16m:${x}:${z}`);
      this.tiles.set(k,{key:k,tx:x,tz:z,seed,count:profile.tufts,contentHash:hash32(k+':'+seed).toString(16).padStart(8,'0')});this.generated++;
    }
    this.ready=true;return true;
  }
  digest(){return [...this.tiles.values()].sort((a,b)=>a.key.localeCompare(b.key)).map(t=>`${t.key}/${t.contentHash}/${t.count}`).join('|');}
  counters(){return {version:this.version,demand:this.demandKey,required:this.required.length,ready:this.required.length,tiles:this.tiles.size,
    tufts:[...this.tiles.values()].reduce((n,t)=>n+t.count,0),typedBytes:0,descriptorCount:this.tiles.size,pending:0,workers:0,generated:this.generated,evicted:this.evicted,failure:this.failure,
    representation:'GPU procedural blades; CPU owns bounded tile descriptors only'};}
}

export function createGrassAtlas(){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const ctx=canvas.getContext('2d');
  for(let variant=0;variant<4;variant++){
    let seed=713+variant*7919;const random=()=>{seed=integerHash(seed+0x9e3779b9);return seed/4294967296;};
    ctx.save();ctx.beginPath();ctx.rect(variant*256,0,256,512);ctx.clip();
    // Three overlapping rows fill the base; tapered silhouettes remain at the top.
    for(let row=0;row<3;row++)for(let i=0;i<96;i++){
      const x=variant*256+random()*256,y=512-row*18-random()*16,h=150+random()*300,w=1.5+random()*3.4,bend=(random()-.5)*36;
      const gradient=ctx.createLinearGradient(x,y,x,y-h);gradient.addColorStop(0,'rgb(16,34,4)');gradient.addColorStop(.45,'rgb(32,61,11)');gradient.addColorStop(1,`rgb(${48+Math.floor(random()*18)},${75+Math.floor(random()*19)},${16+Math.floor(random()*14)})`);
      ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(x-w,y);ctx.quadraticCurveTo(x-w+bend*.2,y-h*.48,x+bend,y-h);ctx.quadraticCurveTo(x+w+bend*.25,y-h*.45,x+w,y);ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
  return canvas;
}

export function stageOffsets(stage,p){
  const tiles=[...stage.tiles.values()].sort((a,b)=>a.key.localeCompare(b.key)),offsets=new Float32Array(tiles.length*2),seeds=new Uint32Array(tiles.length);
  tiles.forEach((t,i)=>{offsets[i*2]=t.tx*16-p.eastM;offsets[i*2+1]=t.tz*16-p.northM;seeds[i]=t.seed;});
  return {tiles,offsets,seeds};
}

export function canopyAtlasFootprint(p,tier){
  const x=Math.floor(p.eastM/tier.pitch)-tier.grid/2,z=Math.floor(p.northM/tier.pitch)-tier.grid/2;
  return {origin:[x*tier.pitch-p.eastM,z*tier.pitch-p.northM],x:splitCell(x),z:splitCell(z)};
}
