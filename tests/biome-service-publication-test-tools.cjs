'use strict';
const crypto=require('node:crypto'),H=require('./fixtures/biome-service/p04-binding-helper.cjs'),R=H.R,V=require('../biome-service/view-envelope.js');
function instrument(storage){
 let interrupt=Infinity,ordinal=0,trace=[],afterComplete=null;
 const point=(kind,store,key)=>{const step={ordinal:++ordinal,kind,store,key:String(key??'')};trace.push(step);if(ordinal===interrupt)throw R.error('STORAGE_UNAVAILABLE','Injected publication transaction interruption',step,'test');};
 const wrapped=Object.freeze({...storage,transaction(stores,mode,body,options){
  if(!stores.includes('worldHeads'))return storage.transaction(stores,mode,body,options);
  ordinal=0;trace=[];
  return storage.transaction(stores,mode,ctx=>{
   const wrappers=new Map(),store=name=>{if(wrappers.has(name))return wrappers.get(name);const actual=ctx.store(name),wrapper=new Proxy(actual,{get(target,key){const value=target[key];if(typeof value!=='function')return value;if(['put','add','delete','clear'].includes(key))return(...args)=>{point(key,name,args[1]??args[0]);return value.apply(target,args);};return value.bind(target);}});wrappers.set(name,wrapper);return wrapper;};
   return body({...ctx,store,request:(request,callback)=>ctx.request(request,value=>{point('request-success',request.source?.name??'index',request.source?.keyPath??'');return callback(value);}),setResult:value=>{point('set-result','transaction','');ctx.setResult(value);}});
  },options).then(value=>{afterComplete?.();return value;});
 }});
 return {storage:wrapped,arm(step,{onComplete=null}={}){interrupt=step;afterComplete=onComplete;},trace:()=>trace.slice()};
}
function serial(value){if(value instanceof ArrayBuffer)return {byteLength:value.byteLength,sha256:crypto.createHash('sha256').update(new Uint8Array(value)).digest('hex')};if(Array.isArray(value))return value.map(serial);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,serial(v)]));return value;}
async function snapshot(storage){const result={};for(const name of storage.stores){const keys=await storage.getAllKeys(name),rows=[];for(const key of keys)rows.push({key,value:serial(await storage.get(name,key))});result[name]=rows;}return result;}
async function departure(env,codec,publisher,operationId){const coreScene=global.SphereMath.validate({...global.SphereMath.defaultState(),collection:true,playing:false}),view=await codec.prepare({format:V.FORMAT,coreScene,biomeView:null});await publisher.stageView(view.digest,{stagingKey:'staging:'+operationId});return view;}
async function plan(env,codec,publisher,{operationId,requestKey,sessionId,releaseDigest,previousBindingEnvelope,expectedHead=null,view}={}){view=view??await departure(env,codec,publisher,operationId);const allocationTicket=await env.builder.planAllocation({...env.input,operationId,requestKey,releaseDigest,...(previousBindingEnvelope?{previousBindingEnvelope}:{})});return {view,allocationTicket,prepare:()=>env.builder.prepare({allocationTicket,expectedHead,callerSession:{sessionId,expectedHead:null},departureViewRef:{digest:view.digest},viewOwner:codec})};}
module.exports={instrument,serial,snapshot,departure,plan};
