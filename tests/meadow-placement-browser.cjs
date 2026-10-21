const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright'),{executable}=require('../tools/playwright-browser.cjs');
(async()=>{
 let browser,server;
 try{
  const root=path.resolve(__dirname,'..');server=http.createServer((request,response)=>{let pathname;try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400).end();return;}const target=path.resolve(root,'.'+pathname);if(!target.startsWith(root+path.sep)){response.writeHead(403).end();return;}fs.readFile(target,(error,body)=>{if(error){response.writeHead(404).end('Not found');return;}const extension=path.extname(target),type=extension==='.html'?'text/html':extension==='.js'?'text/javascript':'application/octet-stream';response.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'}).end(body);});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();
  browser=await chromium.launch({headless:true,executablePath:executable()});
  const page=await browser.newPage({viewport:{width:640,height:360}});
  await page.goto(`http://127.0.0.1:${address.port}/tests/meadow-placement.html`,{waitUntil:'load'});
  await page.waitForFunction(()=>document.getElementById('status').textContent!=='Preparing…',{timeout:120000});
  const status=await page.locator('#status').innerText(),result=JSON.parse(await page.locator('#info').innerText());console.log(JSON.stringify({status,result}));
  assert.equal(status,'PASS');assert.equal(result.status,'PASS');assert.equal(result.placementRevision,2);assert.equal(result.workers,2);
  assert.equal(result.duplicateRootChecks,0);assert.equal(result.duplicateBladeChecks,0);assert.equal(result.workerSyncParity,'exact instance metadata and packed 32-byte records');assert.equal(result.reorderedWorkerParity,true);assert.equal(result.workerCountIndependent,true);
  const output=path.resolve(__dirname,'../docs/evidence/meadow-proof-01/c-worker-parity.json');fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
