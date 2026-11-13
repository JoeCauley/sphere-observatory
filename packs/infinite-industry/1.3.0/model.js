import {address as meadowAddress,clamp} from '../../infinite-meadow/1.0.0/coordinates.js';
import {selection,createFacility,SEED,ART,GEOGRAPHY,DATUM_M} from './facility.js';
export const SITE='industry-water-0-0',ADDRESS_REVISION='industry-address-v1';
export function address(p){return {...meadowAddress(p),siteId:SITE,worldRevision:ADDRESS_REVISION};}
export function initialState(){const config=selection(),facility=createFacility(config);return {schema:1,seed:SEED,worldRevision:GEOGRAPHY,industryRevision:ART,config,pose:{...facility.arrival},routing:'distribution',processTime:0,processPlaying:true,transition:1};}
export function saveState(s){return {...structuredClone(s),pose:{address:address(s.pose),yaw:s.pose.yaw,pitch:s.pose.pitch,mode:s.pose.mode}};}
export function parseState(raw){
 const s=typeof raw==='string'?JSON.parse(raw):structuredClone(raw),a=s.pose?.address;
 if(s?.schema!==1||s.seed!==SEED||s.worldRevision!==GEOGRAPHY||s.industryRevision!==ART||JSON.stringify(s.config)!==JSON.stringify(selection()))throw Error('Unsupported industrial geography, model or appearance');
 if(a?.schema!==1||a.siteId!==SITE||a.worldRevision!==ADDRESS_REVISION)throw Error('Unsupported industrial address');
 for(const p of [a.east,a.north])if(!Number.isSafeInteger(p?.cell)||!Number.isFinite(p.localM)||Math.abs(p.localM)>=256||(p.cell!==0&&p.localM!==0&&Math.sign(p.cell)!==Math.sign(p.localM)))throw Error('Invalid cell address');
 const p={eastM:a.east.cell*256+a.east.localM,northM:a.north.cell*256+a.north.localM,altitudeM:a.altitudeM,yaw:s.pose.yaw,pitch:s.pose.pitch,mode:s.pose.mode};
 if(![p.eastM,p.northM,p.altitudeM,p.yaw,p.pitch].every(Number.isFinite)||Math.abs(p.eastM)>Math.PI*149597870700||Math.abs(p.northM)>Math.PI*.5*149597870700||p.altitudeM>149597870700*.8||Math.abs(p.yaw)>1e4||Math.abs(p.pitch)>1.5||!['walk','flight'].includes(p.mode))throw Error('Invalid industrial viewpoint');
 if(!['distribution','recovery'].includes(s.routing)||!Number.isFinite(s.processTime)||s.processTime<0||s.processTime>1e9||typeof s.processPlaying!=='boolean'||!Number.isFinite(s.transition)||s.transition<0||s.transition>1)throw Error('Invalid process state');
 const f=createFacility(s.config),support=f.support(p.eastM,p.northM,p.altitudeM-1.7);
 if(p.altitudeM<support+1.7-.002||f.blocked(p.eastM,p.northM,p.altitudeM,p.mode==='walk')||p.mode==='walk'&&Math.abs(p.altitudeM-support-1.7)>.01)throw Error('Saved viewpoint is outside safe support');
 s.pose=p;return s;
}
export function canInteract(s,f){return s.pose.mode==='walk'&&Math.hypot(s.pose.eastM-f.control.eastM,s.pose.northM-f.control.northM)<f.control.radiusM&&s.pose.altitudeM<DATUM_M+3;}
export function interact(s,f){if(!canInteract(s,f))return false;s.routing=s.routing==='distribution'?'recovery':'distribution';s.transition=0;return true;}
export function approachPose(f){const p=f.toWorld(0,120);return {...f.arrival,eastM:p[0],northM:p[1],altitudeM:DATUM_M+65,pitch:-.36,mode:'flight'};}
export const boundedPitch=x=>clamp(x,-1.5,1.5);
