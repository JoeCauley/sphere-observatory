import {generateStation} from './station.mjs';

// The file-backed Atlas owns installations served by the Observatory. Static
// hosting uses an IndexedDB transaction so two tabs discover one record.
let database;
function openDatabase(){
  if(!database)database=new Promise((resolve,reject)=>{
    const req=indexedDB.open('sphere-builder-atlas',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('stations');
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  return database;
}
async function browserRecord(a,enter){
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('stations',enter?'readwrite':'readonly'),table=tx.objectStore('stations'),req=table.get(a.key);
    let record;
    req.onsuccess=()=>{
      record=req.result;
      if(!record){
        record={station:generateStation(a),locked:enter,discoveredAt:enter?new Date().toISOString():null};
        if(enter)table.add(record,a.key);
      }
    };
    tx.oncomplete=()=>resolve(record);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Atlas transaction failed.'));
  });
}
export async function stationRecord(address,enter,fileBacked){
  let data;
  if(fileBacked){
    const q=new URLSearchParams({world:address.world,a:address.plots[0],b:address.plots[1],bay:address.bay});
    const url=new URL('../../../api/border-stations',import.meta.url);
    url.search=q;
    const res=await fetch(url,{method:enter?'POST':'GET',cache:'no-store'});
    if(!res.ok)throw Error('Atlas station '+res.status);
    data=await res.json();
  }else data=await browserRecord(address,enter);
  if(data.station?.schema!==1 || data.station.address.key!==address.key || (enter&&!data.locked))throw Error('Atlas returned a different station.');
  return data;
}
