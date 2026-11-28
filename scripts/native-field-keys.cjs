'use strict';
const {randomBytes}=require('node:crypto');
const {spawn}=require('node:child_process');
const {createInterface}=require('node:readline');
const path=require('node:path');

function nativeFieldKeys(root) {
  const scope=randomBytes(8).toString('hex'), tabs=new Map();
  let helper;
  function connect(req,res) {
    const host=req.headers.host||'', url=new URL(req.url,'http://localhost');
    const tab=url.searchParams.get('tab');
    if(req.method!=='GET' || !/^(127\.0\.0\.1|localhost):\d+$/.test(host) ||
       (req.headers.origin && req.headers.origin!=='http://'+host) ||
       !/^[a-f0-9]{16}$/.test(tab||'') || url.searchParams.get('scope')!==scope){
      res.writeHead(403);res.end();return;
    }
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});
    res.write(': Observatory field camera\n\n');
    tabs.get(tab)?.end();
    tabs.set(tab,res);
    if(!helper){
      const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',
        path.join(root,'scripts/field-print-key.ps1'),scope],{windowsHide:true,stdio:['ignore','pipe','ignore']});
      helper=child;
      const lines=createInterface({input:child.stdout});
      lines.on('line',line=>{
        if(/^[a-f0-9]{16}$/.test(line)){tabs.get(line)?.write('event: print\ndata: press\n\n');return;}
        const state=/^(armed|unavailable) ([a-f0-9]{16})(?: (\d+))?$/.exec(line);
        if(state)tabs.get(state[2])?.write('event: field-key-state\ndata: '+state[1]+' '+(state[3]??'')+'\n\n');
      });
      const ended=()=>{if(helper===child)helper=null;lines.close();};
      child.once('error',ended);child.once('exit',ended);
    }
    res.on('close',()=>{
      if(tabs.get(tab)===res)tabs.delete(tab);
      if(tabs.size===0 && helper){const child=helper;helper=null;child.kill();}
    });
  }
  process.once('exit',()=>helper?.kill());
  return {scope,connect};
}
module.exports={nativeFieldKeys};
