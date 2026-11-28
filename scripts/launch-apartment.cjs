'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn,fork}=require('node:child_process'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),expedition=path.dirname(root),args=process.argv.slice(2);
const qa=args.includes('--qa'),port=qa?8854:8852,owner=path.join(expedition,qa?'qa':'pilot'),file=path.join(owner,'installed-biomes.json');
const origin='http://127.0.0.1:'+port,url=origin+'/?apartment=1A',profile=path.join(owner,'orchard-pilot');
const digest=v=>createHash('sha256').update(process.platform==='win32'?v.toUpperCase():v).digest('hex');
async function health(){try{return await (await fetch(origin+'/api/health',{signal:AbortSignal.timeout(600)})).json();}catch{return null;}}
async function ready(){
  if(!fs.existsSync(file))throw Error('Missing the expedition register at '+file);
  const check=state=>{if(!state)return false;
    if(state.service!=='sphere-observatory'||state.checkout!==digest(root)||state.register!==digest(file))
      throw Error('Port '+port+' already serves a different checkout or register.');
    return true;};
  if(check(await health()))return;
  const child=spawn(process.execPath,[path.join(root,'serve.cjs'),String(port)],{cwd:root,stdio:'ignore',windowsHide:true,detached:true,env:{...process.env,SPHERE_INSTALL_STORE:file}});
  child.unref();
  for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,100));if(check(await health()))return;}
  throw Error('The local Observatory did not open port '+port+'.');
}
(async()=>{
  await ready();
  if(args.includes('--url')){console.log(url);return;}
  const exe=[path.join(process.env.ProgramFiles||'C:/Program Files','Google/Chrome/Application/chrome.exe'),
    path.join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe')].find(p=>fs.existsSync(p));
  if(!exe)throw Error('Open '+url+' in a WebGL 2 browser.');
  const {activate}=require('./apartment-window.cjs');
  if(await activate(profile)){console.log('Activated the existing pilot window.');console.log(url);return;}
  const browserArgs=['--user-data-dir='+profile,'--no-first-run','--no-default-browser-check'];
  if(process.env.SPHERE_VERIFY_ORCHARD_WINDOW==='1')browserArgs.push('--remote-debugging-address=127.0.0.1','--remote-debugging-port=0');
  const child=spawn(exe,[...browserArgs,url],{cwd:owner,detached:true,windowsHide:false,stdio:'ignore'});
  const native=await new Promise(resolve=>{
    const timer=setTimeout(()=>resolve(true),1800);
    child.once('exit',code=>{clearTimeout(timer);resolve(code===0);});
    child.once('error',()=>{clearTimeout(timer);resolve(false);});
  });
  child.unref();
  if(native){console.log('Opened with the installed browser.');}
  else{
    // Managed Windows shells can terminate ordinary Chrome during crash reporter startup.
    // Use the installed project driver for this dedicated profile and retain its window.
    const helper=fork(path.join(__dirname,'apartment-window.cjs'),[profile,url,exe],{cwd:root,detached:true,windowsHide:true,stdio:['ignore','ignore','ignore','ipc']});
    await new Promise((resolve,reject)=>{
      helper.once('message',r=>r.opened?resolve():reject(Error(r.error||'The pilot browser failed to open.')));
      helper.once('error',reject);helper.once('exit',code=>reject(Error('Pilot browser exited with status '+code)));
    });
    helper.unref();console.log('Opened with the local Playwright driver in the dedicated pilot profile.');
  }
  console.log(url);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
