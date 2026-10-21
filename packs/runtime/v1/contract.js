export const API_VERSION=1;
const id=/^[a-z][a-z0-9-]{0,63}$/;
const version=/^\d+\.\d+\.\d+$/;
export function assetPath(path){
 if(typeof path!=='string'||!path||path.startsWith('/')||path.includes('\\')||path.split('/').some(p=>!p||p==='.'||p==='..')||/[?#:%]/.test(path))throw Error('Invalid pack asset path');
 return path;
}
export function validateManifest(input){
 const m=structuredClone(input);
 if(m?.schema!==1||m.runtimeApi!==API_VERSION||!id.test(m.id)||!version.test(m.version)||!m.name||!m.geography?.revision||!m.appearance?.revision)throw Error('Unsupported Biome Pack or runtime');
 const g=m.geography,b=m.budgets;
 if(g.coordinateContract!=='shell-tangent-metres-v1'||!Number.isInteger(g.seed)||!(g.cellM>0)||!Number.isFinite(g.eastLimitM)||!Number.isFinite(g.northLimitM)||g.eastLimitM<=0||g.northLimitM<=0||!g.siteId||!g.addressRevision)throw Error('Invalid geographic contract');
 if(!b||b.residentInstances!==1||!Number.isInteger(b.stageCells)||b.stageCells<1||!Number.isFinite(b.gpuBufferBytes)||b.gpuBufferBytes<=0||!Number.isFinite(b.gpuTextureBytes)||b.gpuTextureBytes<0||!Number.isFinite(b.sourceBytes)||b.sourceBytes<=0)throw Error('Invalid pack resource limits');
 assetPath(m.entry);
 if(!Array.isArray(m.assets)||!m.assets.length||!m.assets.some(a=>a.path===m.entry))throw Error('Pack entry is not in its asset inventory');
 const paths=new Set();for(const a of m.assets){assetPath(a.path);if(paths.has(a.path)||!Number.isInteger(a.bytes)||a.bytes<0||!/^[a-f0-9]{64}$/.test(a.sha256))throw Error('Invalid pack asset inventory');paths.add(a.path);}
 if(m.assets.reduce((n,a)=>n+a.bytes,0)>b.sourceBytes)throw Error('Pack source budget exceeded');
 if(!Array.isArray(m.representations)||!m.representations.length||m.representations.some(r=>!id.test(r.id)||!['world','shell'].includes(r.anchor)||(r.anchor==='world'&&r.follows!=='eye')))throw Error('Pack scenery must retain its world anchors and follow the eye');
 if(!/^[a-zA-Z][a-zA-Z0-9]*$/.test(m.appearance.stateField)||m.appearance.stateField==='constructor')throw Error('Invalid scenery state contract');
 if(m.storageKey!=='sphere-pack:'+m.id+':'+m.version)throw Error('Pack storage identity does not match');
 return Object.freeze(m);
}
export function identity(m){return {id:m.id,version:m.version,runtimeApi:m.runtimeApi,geographyRevision:m.geography.revision,appearanceRevision:m.appearance.revision,seed:m.geography.seed};}
export function validateAddress(a,m){
 const g=m.geography;if(a?.schema!==1||a.siteId!==g.siteId||a.worldRevision!==g.addressRevision||!Number.isFinite(a.altitudeM))throw Error('Unsupported pack address');
 const decode=(p,limit)=>{if(!p||!Number.isInteger(p.cell)||!Number.isFinite(p.localM)||Math.abs(p.localM)>=g.cellM)throw Error('Invalid cell address');const value=p.cell*g.cellM+p.localM;if(!Number.isFinite(value)||Math.abs(value)>limit||(Math.trunc(value/g.cellM)||0)!==p.cell)throw Error('Noncanonical or out-of-range pack address');return value;};
 return {eastM:decode(a.east,g.eastLimitM),northM:decode(a.north,g.northLimitM),altitudeM:a.altitudeM};
}
export function createStore(manifest,backend){
 const expected=identity(manifest),key=manifest.storageKey;
 let validator=s=>s;
 const state=s=>{if(!s||s.schema!==1||s.seed!==expected.seed||s.worldRevision!==manifest.geography.sourceWorldRevision||s[manifest.appearance.stateField]!==expected.appearanceRevision)throw Error('Save uses unsupported geography or scenery');validateAddress(s.pose?.address,manifest);return structuredClone(validator(structuredClone(s)));};
 function encode(payload){const current=state(payload.state),bookmark=state(payload.bookmark),raw=JSON.stringify({format:'sphere-biome-pack',schema:1,pack:expected,address:current.pose.address,state:current,bookmark});if(raw.length>1000000)throw Error('Pack save exceeds 1 MB');return raw;}
 function decode(raw,{allowLegacy=false}={}){if(typeof raw!=='string'||raw.length>1000000)throw Error('Invalid pack save');const r=JSON.parse(raw);if(allowLegacy&&r?.schema===1&&!r.format){const s=state(r);return {state:s,bookmark:structuredClone(s),migratedFrom:'explicit-study-save'};}
  if(r?.format!=='sphere-biome-pack'||r.schema!==1||Object.keys(expected).some(k=>r.pack?.[k]!==expected[k]))throw Error('Unsupported Biome Pack save or revision');
  const s=state(r.state),bookmark=state(r.bookmark);if(JSON.stringify(r.address)!==JSON.stringify(s.pose.address))throw Error('Save address and viewpoint disagree');return {state:s,bookmark};
 }
 return {key,encode,decode,useValidator:fn=>{if(typeof fn!=='function')throw Error('Invalid state validator');validator=fn;},read:()=>{const raw=backend.getItem(key);return raw===null?null:decode(raw);},write:payload=>{const raw=encode(payload);backend.setItem(key,raw);return raw;},lastRelease:()=>{try{const raw=backend.getItem('sphere-pack-last-release-v1');if(!raw||raw.length>20000)return null;const r=JSON.parse(raw);return r?.schema===1&&r.identity?.id===expected.id&&r.identity?.version===expected.version&&r.status==='disposed'?r:null;}catch{return null;}},releaseReceipt:record=>backend.setItem('sphere-pack-last-release-v1',JSON.stringify(record))};
}
export async function verifyAssets(manifest,base,{fetcher=fetch,digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join(''),signal}={}){
 const results=await Promise.all(manifest.assets.map(async a=>{const url=new URL(a.path,base);if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))throw Error('Asset left its pack');const response=await fetcher(url,{cache:'no-store',signal});if(!response.ok)throw Error('The meadow could not load '+a.path);const bytes=await response.arrayBuffer();if(bytes.byteLength!==a.bytes||await digest(bytes)!==a.sha256)throw Error('Pack asset changed: '+a.path);return a.path;}));
 return {ready:results.length,required:manifest.assets.length,bytes:manifest.assets.reduce((n,a)=>n+a.bytes,0),exact:true};
}
