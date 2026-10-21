import {validateManifest,identity,createStore,verifyAssets} from './contract.js';
import {WorldStage} from './stage.js';import {ResourceLease} from './resources.js';
const activeHosts=new WeakMap();
export class PackHost {
 constructor(input,base,{storage=localStorage,win=window,doc=document}={}){
  this.manifest=validateManifest(input);this.base=base;this.win=win;this.doc=doc;this.storage=createStore(this.manifest,storage);this.stage=new WorldStage(this.manifest.geography);this.status='preparing';this.assets=null;this.adapter=null;this.leases=[];this.listeners=[];this.frames=new Set();this.timers=new Set();this.urls=new Set();this.streams=new Set();this.abort=new AbortController();this.lastRelease=null;
 }
 listen(target,type,handler,options){target.addEventListener(type,handler,options);this.listeners.push(()=>target.removeEventListener(type,handler,options));}
 frame(fn){if(this.status==='disposed'||this.status==='failed')return;const token=this.win.requestAnimationFrame(t=>{this.frames.delete(token);if(this.status==='ready')try{fn(t);}catch(e){this.fail(e);}});this.frames.add(token);return token;}
 delay(fn,ms){const token=this.win.setTimeout(()=>{this.timers.delete(token);if(this.status==='ready')fn();},ms);this.timers.add(token);return token;}
 objectURL(blob){const url=URL.createObjectURL(blob);this.urls.add(url);return url;}
 revokeURL(url){URL.revokeObjectURL(url);this.urls.delete(url);}
 media(stream){this.streams.add(stream);return stream;}
 stopMedia(stream){for(const track of stream.getTracks())track.stop();this.streams.delete(stream);}
 trackContext(gl){if(this.leases.length)throw Error('Only one resident graphics context is supported');const lease=new ResourceLease(gl,this.manifest.budgets);this.leases.push(lease);return lease;}
 inspect(){return {identity:identity(this.manifest),status:this.status,assets:this.assets,stage:this.stage.inspect(),resources:this.leases.map(l=>l.inspect()),eventListeners:this.listeners.length,pendingFrames:this.frames.size,pendingTimers:this.timers.size,objectURLs:this.urls.size,mediaStreams:this.streams.size,release:this.lastRelease,previousRelease:this.storage.lastRelease()};}
 async start({fetcher,loader=url=>import(url.href),digest}={}){
  if(this.status!=='preparing')throw Error('Pack instance has already started');
  if(activeHosts.has(this.win))throw Error('Another pack is already resident in this document');activeHosts.set(this.win,this);
  try{this.assets=await verifyAssets(this.manifest,this.base,{fetcher,digest,signal:this.abort.signal});if(this.status==='disposed')return;
   const module=await loader(new URL(this.manifest.entry,this.base));if(this.status==='disposed')return;if(typeof module.mountPack!=='function')throw Error('Pack has no scene adapter');
   this.status='mounting';this.adapter=module.mountPack(this);if(!this.adapter?.snapshot||!this.adapter?.dispose)throw Error('Incomplete pack lifecycle adapter');
   this.status='ready';this.doc.getElementById('packLoading').hidden=true;this.doc.getElementById('packLifecycle').textContent='Meadow ready · saves stay in this browser';
   this.listen(this.win,'pagehide',()=>{try{this.checkpoint();}finally{this.dispose();}});
   this.listen(this.win,'pageshow',e=>{if(e.persisted&&this.status==='disposed')this.win.location.reload();});
   this.listen(this.doc.getElementById('leavePack'),'click',()=>{try{this.checkpoint();this.dispose();this.win.location.assign(new URL('../../../index.html',this.base).href);}catch(e){this.doc.getElementById('status').textContent='Could not keep this viewpoint: '+e.message+'. Download a save before leaving.';}});
   return this.inspect();
  }catch(e){if(this.status!=='disposed')this.fail(e);throw e;}
 }
 checkpoint(){if(this.adapter)this.storage.write(this.adapter.snapshot());}
 fail(error){this.dispose();this.status='failed';const panel=this.doc.getElementById('packLoading'),text=this.doc.getElementById('packLoadingStatus'),retry=this.doc.getElementById('packRetry');if(panel)panel.hidden=false;if(text)text.textContent=error.message;if(retry){retry.hidden=false;retry.onclick=()=>this.win.location.reload();}}
 dispose(){if(this.status==='disposed')return this.inspect();this.status='disposed';this.abort.abort();for(const token of this.frames)this.win.cancelAnimationFrame(token);this.frames.clear();for(const token of this.timers)this.win.clearTimeout(token);this.timers.clear();for(const remove of this.listeners)remove();this.listeners.length=0;try{this.adapter?.dispose();}finally{this.adapter=null;for(const stream of this.streams)for(const track of stream.getTracks())track.stop();this.streams.clear();for(const url of this.urls)URL.revokeObjectURL(url);this.urls.clear();this.lastRelease=this.leases.map(l=>l.dispose());this.stage.dispose();if(activeHosts.get(this.win)===this)activeHosts.delete(this.win);for(const el of this.doc.querySelectorAll('button,input,select'))for(const event of ['onclick','oninput','onchange'])el[event]=null;try{const {previousRelease,...receipt}=this.inspect();this.storage.releaseReceipt({schema:1,date:new Date().toISOString(),...receipt});}catch{}}return this.inspect();}
}
