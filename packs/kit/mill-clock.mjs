import {emptyProduction,freshMill,lastDeadline,millAt,remainingMs} from './rolling-mill.mjs';
import {transact} from './mill-transaction.mjs';

export function httpJournal(world) {
  const url='/api/industry-mills?world='+encodeURIComponent(world);
  async function send(request) {
    const response=await fetch(url,request?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),keepalive:true}:{cache:'no-store'});
    const reply=await response.json();
    if (!response.ok && !(response.status===409 && reply.state)) throw Error(reply.error||'Mill journal unavailable');
    return reply;
  }
  return {read:()=>send(),send,close:request=>navigator.sendBeacon(url,new Blob([JSON.stringify(request)],{type:'application/json'}))};
}

export function localJournal(storage,key) {
  const load=()=>JSON.parse(storage.getItem(key)||'null')??emptyProduction();
  const send=request=>{const result=transact(load(),request,request.address);storage.setItem(key,JSON.stringify(result.state));return result;};
  return {read:()=>({state:load()}),send,close:send};
}

// A single running time per installed world. Unloaded machines have no tick,
// timer or worker. Only accepted actions, live-job heartbeats and exit write.
export class MillClock {
  constructor(journal,storage,pendingKey) {
    this.journal=journal;this.storage=storage;this.pendingKey=pendingKey;
    this.state=emptyProduction();this.time=0;this.deadline=0;this.ready=false;
    this.empty=freshMill();this.running=false;this.busy=false;this.writing=false;this.cooldown=0;this.error='';
  }
  adopt(state) {
    // An earlier heartbeat response can arrive after a later material command.
    const machines={...this.state.machines};
    for(const [key,record] of Object.entries(state.machines)){
      if(!machines[key] || record.revision>=machines[key].revision)machines[key]=record;
    }
    this.state={...state,atMs:Math.max(this.state.atMs,state.atMs),machines};
    this.time=Math.max(this.time,state.atMs);this.deadline=lastDeadline(this.state);
  }
  async refresh(){
    try{this.adopt((await this.journal.read()).state);this.error='';}
    catch(e){this.error=e.message;}
  }
  async open(){
    if(this.ready)return;
    if(this.opening)return this.opening;
    this.opening=(async()=>{
      this.adopt((await this.journal.read()).state);
      this.ready=true;this.error='';
      const pending=JSON.parse(this.storage.getItem(this.pendingKey)||'null');
      if(pending)await this.submit(pending);
    })().catch(e=>{this.error=e.message;}).finally(()=>{this.opening=null;});
    return this.opening;
  }
  step(seconds,playing) {
    if(!this.ready)return;
    const was=this.running;this.running=!!playing;
    if(this.running && Number.isFinite(seconds) && seconds>0)this.time+=seconds*1000;
    this.cooldown=Math.max(0,this.cooldown-Math.max(0,seconds||0)*1000);
    if(this.needsClock() && ((was&&!this.running) || (!this.cooldown && (this.time-this.state.atMs>=2000 || this.time>=this.deadline))))this.flush();
  }
  needsClock(){return this.ready && this.deadline>this.state.atMs && Math.round(this.time)>this.state.atMs;}
  clockRequest(){return {verb:'clock',atMs:Math.round(this.time)};}
  async flush(){
    if(this.writing || this.busy || !this.needsClock())return;
    this.writing=true;this.cooldown=1000;
    try{this.adopt((await this.journal.send(this.clockRequest())).state);this.error='';}
    catch(e){this.error=e.message;}
    finally{this.writing=false;}
  }
  close(){
    if(this.ready&&Math.round(this.time)>this.state.atMs&&Object.keys(this.state.machines).length)this.journal.close(this.clockRequest());
  }
  view(address) {
    const atMs=Math.round(this.time),record=millAt(this.state.machines[address]??this.empty,atMs);
    return {address,atMs,record,remainingMs:remainingMs(record,atMs),playing:this.running,ready:this.ready,error:this.error};
  }
  async submit(request) {
    const result=await this.journal.send(request);
    this.adopt(result.state);this.storage.removeItem(this.pendingKey);this.error='';
    return result.rejected||'';
  }
  async act(address,instance,verb) {
    if(this.busy)return 'Waiting for the mill.';
    this.busy=true;
    try{
      if(!this.ready){
        const recovering=!!this.storage.getItem(this.pendingKey);
        await this.open();if(!this.ready)throw Error(this.error||'Mill journal unavailable');
        if(recovering&&!this.storage.getItem(this.pendingKey))return 'Previous command confirmed.';
      }
      const previous=JSON.parse(this.storage.getItem(this.pendingKey)||'null');
      if(previous)return await this.submit(previous)||'Previous command confirmed.';
      if(!this.running && (verb==='feed'||verb==='dispatch'))return 'World time is paused.';
      const request={address,instance,verb,id:crypto.randomUUID(),expected:this.view(address).record.revision,atMs:Math.round(this.time)};
      this.storage.setItem(this.pendingKey,JSON.stringify(request));
      return await this.submit(request);
    }catch(e){this.error=e.message;return 'Mill journal: '+e.message;}
    finally{this.busy=false;}
  }
}
