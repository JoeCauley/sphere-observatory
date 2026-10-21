const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
export async function loadRegistry({base=new URL('.',import.meta.url),fetcher=fetch}={}){
 const sourceRoot=new URL('../../../',base);
 const checkedURL=path=>{
  if(typeof path!=='string'||!path||path.includes('\\')||/[?#%:]/.test(path))throw Error('Invalid registered world file');
  const url=new URL(path,base);if(url.origin!==base.origin||!url.pathname.startsWith(sourceRoot.pathname))throw Error('Registered file left this Observatory');return url;
 };
 const response=await fetcher(new URL('registry.json',base),{cache:'no-store'});if(!response.ok)throw Error('The two-pack world registry is unavailable');
 const registry=await response.json();
 if(registry.schema!==1||registry.runtimeApi!=='sphere-shared-world-v1'||registry.worldId!=='meadow-industry'||registry.worldVersion!=='1.1.0'||registry.packs?.length!==2)throw Error('Unsupported shared world registry');
 const expected=new Set(['infinite-meadow','infinite-industry']);
 for(const pack of registry.packs){if(!expected.delete(pack.id)||pack.version!=='1.2.0'||pack.contentVersion!=='1.0.0'||!pack.name||!pack.manifest)throw Error('Unsupported registered Biome Pack');}
 if(expected.size||!registry.geography||registry.geography.cellM!==256||!(registry.budgets?.gpuBufferBytes>0)||registry.budgets.gpuTextureBytes!==0)throw Error('Incomplete shared world contract');
 const files=[...(registry.sharedAssets||[]),...(registry.dependencies||[])],seen=new Set(),verified=new Map();
 if(!files.length)throw Error('The world has no pinned source inventory');
 await Promise.all(files.map(async file=>{
  const url=checkedURL(file.path);if(seen.has(url.href)||!Number.isSafeInteger(file.bytes)||file.bytes<0||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Invalid shared world inventory');seen.add(url.href);
  const reply=await fetcher(url,{cache:'no-store'});if(!reply.ok)throw Error('World file unavailable: '+file.path);
  const bytes=await reply.arrayBuffer();if(bytes.byteLength!==file.bytes||await hash(bytes)!==file.sha256)throw Error('World file changed: '+file.path);verified.set(url.href,bytes);
 }));
 for(const pack of registry.packs){
  const bytes=verified.get(checkedURL(pack.manifest).href);if(!bytes)throw Error('Pack release is not pinned');
  const manifest=JSON.parse(new TextDecoder().decode(bytes));
  if(manifest.schema!==1||manifest.runtimeApi!==registry.runtimeApi||manifest.id!==pack.id||manifest.name!==pack.name||manifest.version!==pack.version||manifest.contentVersion!==pack.contentVersion||manifest.world?.id!==registry.worldId||manifest.world?.version!==registry.worldVersion)throw Error('Pack release and world registry disagree');
 }
 return freeze({...registry,verification:{exact:true,files:files.length,bytes:files.reduce((sum,file)=>sum+file.bytes,0)}});
}
