'use strict';
const net=require('node:net'),path=require('node:path'),os=require('node:os'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
function pipeName(profile){
  const id=createHash('sha256').update(path.resolve(profile).toLowerCase()).digest('hex').slice(0,24);
  return process.platform==='win32'?'\\\\.\\pipe\\sphere-orchard-'+id:path.join(os.tmpdir(),'orchard-'+id+'.sock');
}
function activate(profile){
  return new Promise(resolve=>{
    const socket=net.connect(pipeName(profile));let reply='';
    socket.setTimeout(4500,()=>socket.destroy());
    socket.on('data',s=>{reply+=s;});socket.on('error',()=>{});socket.on('close',()=>resolve(reply==='ready'));
  });
}
function driver(){
  try{return require('playwright').chromium;}catch{}
  const root=path.resolve(__dirname,'..');
  const gitDir=execFileSync('git',['-C',root,'rev-parse','--path-format=absolute','--git-common-dir'],{encoding:'utf8',windowsHide:true}).trim();
  return require(require.resolve('playwright',{paths:[path.dirname(gitDir)]})).chromium;
}
async function open(profile,url,exe,field){
  const args=['--start-maximized','--no-first-run','--no-default-browser-check'];
  if(process.env.SPHERE_VERIFY_ORCHARD_WINDOW==='1')args.push('--remote-debugging-address=127.0.0.1','--remote-debugging-port=0');
  const ctx=await driver().launchPersistentContext(profile,{executablePath:exe,headless:false,viewport:null,args});
  const initial=ctx.pages();
  // Chromium can reserve a first-tab strip even after the native window enters fullscreen.
  const p=field==='field'||!initial.length?await ctx.newPage():initial[0];
  if(field==='field')await require('./open-field-window.cjs').bindFieldFullscreen(p,url);
  async function show(){
    if(p.url()!==url||(field!=='field'&&!await p.evaluate(()=>document.querySelector('#stageFrame iframe')?.dataset.locationId==='infinite-new-york').catch(()=>false)))
      await p.goto(url,{waitUntil:'domcontentloaded'});
    await p.bringToFront();
  }
  const server=net.createServer(socket=>{void show().then(()=>socket.end('ready'),()=>socket.end('failed'));});
  try{
    await show();
    if(field==='field' && initial.length===1 && initial[0].url()==='about:blank')await initial[0].close();
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(pipeName(profile),resolve);});
    process.send?.({opened:true});process.disconnect?.();
    await ctx.waitForEvent('close',{timeout:0});
  }finally{server.close();await ctx.close().catch(()=>{});}
}
module.exports={activate};
if(require.main===module)open(...process.argv.slice(2)).catch(error=>{process.send?.({error:error.message});process.exitCode=1;process.disconnect?.();});
