'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{executable}=require('../tools/playwright-browser.cjs');
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:executable()});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.IB075_F_BASE_URL||'http://127.0.0.1:8766/')+'tests/meadow-canopy-workers.html');
  await page.waitForFunction(()=>document.querySelector('#status').textContent!=='Preparing…',{timeout:120000});
  const result=JSON.parse(await page.locator('#info').innerText());assert.equal(result.status,'PASS',JSON.stringify(result));assert.deepEqual(errors,[]);
  assert(result.cellParity.every(c=>c.byteIdentical));assert.equal(result.descriptor.byteIdentical,true);
  result.browser=browser.version();
  if(process.env.IB075_F_OUTPUT){fs.mkdirSync(process.env.IB075_F_OUTPUT,{recursive:true});fs.writeFileSync(path.join(process.env.IB075_F_OUTPUT,'f-worker-parity.json'),JSON.stringify(result,null,2)+'\n');}
  console.log(JSON.stringify(result));
 }finally{await browser?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
