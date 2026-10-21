/* A cancellable preparation owner. Publication remains a separate transaction. */
(function(root){
'use strict';
const R=root.SphereBiomeRecords||(typeof module!=='undefined'?require('./records.js'):null),B=root.SphereBiomeBindingBuilder||(typeof module!=='undefined'?require('./binding-builder.js'):null),V=root.SphereBiomeViewEnvelope||(typeof module!=='undefined'?require('./view-envelope.js'):null);
const owners=new WeakSet();
function fail(code,message){throw R.error(code,message,{},'plan-preparation');}
function create({bindingOwner,viewOwner}={}){
 if(!B.isOwner(bindingOwner)||!V.isOwner(viewOwner))fail('UNSUPPORTED_CONTRACT','Authentic binding and complete-view owners are required');
 let disposed=false,active=null,generation=0,last=null;
 async function prepare(input,{signal}={}){
  if(disposed)fail('OWNER_DISPOSED','Plan preparation owner is disposed');if(active)fail('PREPARATION_BUSY','One install preparation is already active');
  const snapshot=input.snapshot,owned=R.deepFreeze(R.clone(Object.fromEntries(Object.entries(input).filter(([key])=>key!=='snapshot')))),controller=new AbortController(),token=++generation;
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();active={controller,token};
  try{
   const allocation=await bindingOwner.planAllocation({snapshot,...owned},{signal:controller.signal});
   if(controller.signal.aborted||token!==generation)fail('CANCELLED','Install preparation was cancelled');
   if(allocation.status){last=R.deepFreeze(R.clone(allocation));return last;}if(bindingOwner.inspectAllocation(allocation).status!=='COMPLETE')fail('UNVERIFIED_ALLOCATION','Allocation did not reach an independently verified completion');
   const ticket=await bindingOwner.prepare({allocationTicket:allocation,expectedHead:owned.expectedHead??null,callerSession:owned.callerSession,departureViewRef:owned.departureViewRef,viewOwner,readinessScope:B.SCOPE},{signal:controller.signal});
   last=bindingOwner.inspectPrepared(ticket);return ticket;
  }finally{signal?.removeEventListener('abort',abort);if(active?.token===token)active=null;}
 }
 function cancel(){if(!active)return false;active.controller.abort();return true;}
 function dispose(){if(disposed)return;if(active)fail('PREPARATION_BUSY','Cancel and settle preparation before disposal');disposed=true;last=null;}
 const owner=Object.freeze({prepare,cancel,inspect:()=>R.deepFreeze(R.clone({disposed,running:!!active,generation,last,scope:B.SCOPE,published:false})),dispose});owners.add(owner);return owner;
}
const api=Object.freeze({create,isOwner:owner=>owners.has(owner)});root.SphereBiomePlanPreparation=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
