'use strict';
const path=require('node:path');
const {fork,spawn}=require('node:child_process');

// Some managed Chromium windows enter document fullscreen without changing their native bounds.
async function bindFieldFullscreen(page,url) {
  const origin=new URL(url).origin;
  const dev=await page.context().newCDPSession(page);
  let restore=null,update=Promise.resolve();
  async function sync() {
    if(new URL(page.url()).origin!==origin)return;
    const state=await page.evaluate(()=>({full:document.fullscreenElement===document.documentElement,
      fills:innerWidth===screen.width && innerHeight===screen.height}));
    const {windowId,bounds}=await dev.send('Browser.getWindowForTarget');
    const set=bounds=>dev.send('Browser.setWindowBounds',{windowId,bounds});
    if(state.full && !state.fills && !restore && bounds.windowState!=='fullscreen'){
      await set({windowState:'fullscreen'});restore=bounds;
    }else if(!state.full && restore){
      const saved=restore;
      await set({windowState:'normal'});
      if(saved.windowState==='normal')await set({left:saved.left,top:saved.top,width:saved.width,height:saved.height});
      else await set({windowState:saved.windowState});
      restore=null;
    }
  }
  await page.exposeBinding('syncFieldFullscreen',({frame})=>{
    if(frame!==page.mainFrame() || new URL(frame.url()).origin!==origin)return;
    update=update.catch(()=>{}).then(sync);return update;
  });
  await page.addInitScript(()=>{
    if(window!==top)return;
    document.addEventListener('fullscreenchange',()=>setTimeout(()=>window.syncFieldFullscreen().catch(()=>{}),140));
  });
}

async function openFieldWindow(profile,url,exe){
  const {activate}=require('./apartment-window.cjs');
  if(await activate(profile))return;
  const args=['--user-data-dir='+profile,'--start-maximized','--no-first-run','--no-default-browser-check'];
  if(process.env.SPHERE_VERIFY_ORCHARD_WINDOW==='1')args.push('--remote-debugging-address=127.0.0.1','--remote-debugging-port=0');
  const child=spawn(exe,[...args,url],{detached:true,windowsHide:false,stdio:'ignore'});
  const opened=await new Promise(resolve=>{
    const timer=setTimeout(()=>resolve(true),1800);
    child.once('error',()=>{clearTimeout(timer);resolve(false);});
    child.once('exit',code=>{clearTimeout(timer);resolve(code===0);});
  });
  child.unref();if(opened)return;
  const helper=fork(path.join(__dirname,'apartment-window.cjs'),[profile,url,exe,'field'],{
    detached:true,windowsHide:true,stdio:['ignore','ignore','ignore','ipc']
  });
  await new Promise((resolve,reject)=>{
    helper.once('message',m=>m.opened?resolve():reject(Error(m.error||'The field window could not open.')));
    helper.once('error',reject);helper.once('exit',code=>reject(Error('The field window exited with status '+code+'.')));
  });
  helper.unref();
}
module.exports={bindFieldFullscreen};
if(require.main===module)openFieldWindow(...process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
