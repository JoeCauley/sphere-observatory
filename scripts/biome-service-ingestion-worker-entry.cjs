/* Fixed host worker entry; imported data cannot select this code or another entry. */
const R=require('../biome-service/records.js');
const I=require('../biome-service/ingestion-worker.js');
self.onmessage=async event=>{
 const {generation,source,options}=event.data||{};if(!Number.isSafeInteger(generation)||generation<1)return;
 try{const result=await I.inspectPackage(source,options||{}),transfer=[result.rawManifest.buffer,...[...result.resources.values()].map(bytes=>bytes.buffer)];result.accounting={...result.accounting,transferBytes:transfer.reduce((sum,buffer)=>sum+buffer.byteLength,0)};self.postMessage({generation,result},transfer);}
 catch(cause){self.postMessage({generation,error:{code:cause.code||'INVALID_DESCRIPTOR',message:cause.message,details:cause.details||{}}});}
};
