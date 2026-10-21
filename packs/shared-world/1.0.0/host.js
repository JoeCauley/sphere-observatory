import {ResourceLease} from '../../runtime/v1/resources.js';
import {WorldStage} from '../../runtime/v1/stage.js';
import {DATUM_M} from '../../infinite-industry/1.0.0/facility.js';

export const SAVE_KEY='sphere-shared-world:meadow-industry:1.0.0';
export const PACK_IDS=Object.freeze(['infinite-meadow','infinite-industry']);
export const RELEASE_KEY='sphere-shared-world-last-release-v1';

export function readRelease(storage){
 try{const text=storage.getItem(RELEASE_KEY);if(text===null||text.length>20000)return null;const r=JSON.parse(text);
  if(r.schema!==1||r.sharedWorld!==true||r.worldId!=='meadow-industry'||r.worldVersion!=='1.0.0'||!PACK_IDS.includes(r.identity?.id)||r.identity?.version!=='1.1.0'||r.status!=='disposed'||typeof r.saved!=='boolean'||r.resources?.liveResources!==0||r.pendingFrames!==0||r.listeners!==0||r.failures?.length!==0||r.child?.workerDisposed!==true||r.child?.rendererDisposed!==true)return null;
  return r;
 }catch{return null;}
}

export function elapsedSteps(previousMs,currentMs){
 if((previousMs!==null&&!Number.isFinite(previousMs))||!Number.isFinite(currentMs))throw Error('Invalid display clock');
 const elapsedSeconds=previousMs===null?0:Math.max(0,(currentMs-previousMs)/1000),acceptedSeconds=Math.min(1,elapsedSeconds),steps=Math.ceil(acceptedSeconds/.05);
 return {elapsedSeconds,acceptedSeconds,droppedSeconds:elapsedSeconds-acceptedSeconds,steps,stepSeconds:steps?acceptedSeconds/steps:0};
}

export function readCheckpoint(storage,parse,reference){
 const text=storage.getItem(SAVE_KEY);if(text===null)return null;
 if(text.length>1000000)throw Error('Shared save exceeds 1 MB');
 const payload=JSON.parse(text);
 if(payload.schema!==1||payload.worldId!=='meadow-industry'||payload.worldVersion!=='1.0.0')throw Error('Shared save belongs to another world');
 return {state:parse(payload.state,reference),bookmark:parse(payload.bookmark,reference)};
}
export function writeCheckpoint(storage,state,bookmark,save){
 const text=JSON.stringify({schema:1,worldId:'meadow-industry',worldVersion:'1.0.0',state:save(state),bookmark:save(bookmark)});
 if(text.length>1000000)throw Error('Shared save exceeds 1 MB');
 storage.setItem(SAVE_KEY,text);return text.length;
}
export function arrivalCommand(search){
 const q=new URLSearchParams(search),pack=q.get('pack')==='infinite-industry'?'industry':'meadow',arrival=q.get('arrival');
 return {pack,arrival:['ground','flight'].includes(arrival)?arrival:'saved'};
}
export function zoneDemand(facility,pose){
 return facility.zones.map(z=>({id:z.id,d:Math.hypot(z.worldCenter[0]-pose.eastM,z.worldCenter[1]-pose.northM)-z.radius}))
  .filter(z=>z.d<100&&pose.altitudeM<DATUM_M+100).sort((a,b)=>a.d-b.d||a.id.localeCompare(b.id)).map(z=>z.id);
}
export function bearingTo(pose,eastM,northM){
 const de=eastM-pose.eastM,dn=northM-pose.northM,distanceM=Math.hypot(de,dn),yaw=Math.atan2(de,-dn);
 const relative=Math.atan2(Math.sin(yaw-pose.yaw),Math.cos(yaw-pose.yaw));
 return {distanceM,yaw,relative,direction:['N','NE','E','SE','S','SW','W','NW'][Math.round(((yaw*180/Math.PI)%360+360)/45)%8]};
}

// This host owns the single browser loop and context. Content providers do not.
export class SharedWorldHost{
 constructor(canvas,registry,{window:win=window,document:doc=document}={}){
  this.canvas=canvas;this.registry=registry;this.window=win;this.document=doc;
  this.status='starting';this.listeners=[];this.frames=new Set();this.contextCount=0;this.lease=null;
  this.stage=new WorldStage(registry.geography);this.controller=null;this.lastCleanup=null;this.error=null;
  try{this.previousRelease=readRelease(win.localStorage);}catch{this.previousRelease=null;}
 }
 listen(target,type,fn,options){const wrapped=event=>{if(this.status==='disposed')return;try{fn(event);}catch(error){this.fail(error);}};target.addEventListener(type,wrapped,options);this.listeners.push([target,type,wrapped,options]);return wrapped;}
 frame(fn){if(this.status!=='ready')return null;const id=this.window.requestAnimationFrame(time=>{this.frames.delete(id);if(this.status!=='ready')return;try{fn(time);}catch(error){this.fail(error);}});this.frames.add(id);return id;}
 trackContext(gl){if(this.lease)throw Error('The shared world already has a graphics context');this.lease=new ResourceLease(gl,this.registry.budgets);this.contextCount=1;return this.lease;}
 ready(controller){if(this.status!=='starting')throw Error('Shared world cannot start twice');this.controller=controller;this.status='ready';}
 fail(error){if(this.status==='disposed')return;this.error=String(error?.message??error);this.dispose('error');const status=this.document.getElementById('status');if(status)status.textContent='The shared world stopped: '+this.error;const loading=this.document.getElementById('loading');if(loading){loading.hidden=false;loading.textContent=this.error+' · Reload to try again.';}}
 dispose(reason='leave'){
  if(this.status==='disposed')return this.lastCleanup;this.status='disposing';
  for(const id of this.frames)this.window.cancelAnimationFrame(id);this.frames.clear();
  const failures=[];try{this.controller?.dispose();}catch(error){failures.push(String(error.message));}
  for(const [target,type,fn,options]of this.listeners)target.removeEventListener(type,fn,options);this.listeners.length=0;
  try{this.lastCleanup=this.lease?.dispose()??null;}catch(error){failures.push(String(error.message));}
  this.stage.dispose();this.status='disposed';this.lastCleanup={reason,resources:this.lastCleanup,failures,pendingFrames:this.frames.size,listeners:this.listeners.length};
  const child=this.controller?.cleanupEvidence?.()??null,r=this.lastCleanup.resources;
  const complete=!!r&&r.liveResources===0&&r.bufferBytes===0&&r.textureBytes===0&&this.frames.size===0&&this.listeners.length===0&&failures.length===0&&child?.workerDisposed===true&&child?.rendererDisposed===true&&child?.grassTiles===0;
  this.lastCleanup.child=child;
  const receipt={schema:1,date:new Date().toISOString(),identity:{id:this.selectedPackId??'infinite-meadow',version:'1.1.0'},sharedWorld:true,worldId:this.registry.worldId,worldVersion:this.registry.worldVersion,packIds:[...PACK_IDS],status:complete?'disposed':'cleanup-incomplete',saved:child?.checkpointResult?.success===true,checkpointResult:child?.checkpointResult??{attempted:false,success:false},...this.lastCleanup};
  try{this.window.localStorage.setItem(RELEASE_KEY,JSON.stringify(receipt));}catch(error){failures.push('Could not record shared cleanup: '+error.message);}
  try{this.controller?.refreshDetails?.();}catch(error){failures.push(String(error.message));}return this.lastCleanup;
 }
 inspect(){return {worldId:this.registry.worldId,worldVersion:this.registry.worldVersion,status:this.status,contextCount:this.contextCount,canvasCount:1,packIds:[...PACK_IDS],pendingFrames:this.frames.size,listeners:this.listeners.length,stage:this.stage.inspect(),resources:this.lease?.inspect()??null,cleanup:this.lastCleanup,previousRelease:this.previousRelease?structuredClone(this.previousRelease):null,error:this.error};}
}
