/* Resolve the Playwright browser for local CI and the Windows Codex host. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
function executable(){
 if(process.env.SPHERE_BROWSER)return process.env.SPHERE_BROWSER;
 if(process.platform==='win32'&&process.env.LOCALAPPDATA){
  const root=path.join(process.env.LOCALAPPDATA,'ms-playwright');
  if(fs.existsSync(root))for(const entry of fs.readdirSync(root).sort().reverse()){
   if(!entry.startsWith('chromium_headless_shell-'))continue;
   const candidate=path.join(root,entry,'chrome-headless-shell-win64','chrome-headless-shell.exe');
   if(fs.existsSync(candidate))return candidate;
  }
 }
 return chromium.executablePath();
}
module.exports={executable};
