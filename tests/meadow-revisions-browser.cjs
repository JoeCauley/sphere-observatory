'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{chromium}=require('playwright'),{executable}=require('../tools/playwright-browser.cjs'),F=require('./fixtures/meadow-hr00-contract-v1.json');
(async()=>{let browser;try{
 const base=process.env.IB075_HR00_BASE_URL||'http://127.0.0.1:8766/',errors=[];
 browser=await chromium.launch({headless:true,executablePath:executable()});const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 // Isolated classic-script contract context; no beauty or performance gate.
 await page.goto(base+'tests/meadow-revisions.html');await page.waitForFunction(()=>window.SphereSessionCodec&&window.SphereVegetationRevisions);
 const results=await page.evaluate(fixture=>{const result=[];for(const c of fixture.cases){result.push({id:c.id,validated:JSON.stringify(SphereMath.validate(c.state)),session:JSON.stringify(SphereSessionCodec.decode(JSON.stringify({format:'sphere-session',version:2,shadeBodyVersion:3,state:c.state})).state)});}const state=fixture.cases.find(c=>c.id==='F2-G2').state;let rejected=false;try{SphereMath.validate({...state,meadow:{...state.meadow,packetRevision:2}});}catch(e){rejected=/Unsupported vegetation/.test(e.message);}return {cases:result,rejected,current:SphereVegetationRevisions.CURRENT};},F);
 const sha=value=>crypto.createHash('sha256').update(value).digest('hex');for(const [i,c] of results.cases.entries()){assert.equal(sha(c.validated),F.cases[i].validatedSha256,c.id);assert.equal(sha(c.session),F.cases[i].sessionSha256,c.id);}assert(results.rejected);assert.deepEqual(results.current,F.current);assert.deepEqual(errors,[]);
 const report={schema:1,status:'PASS',browser:browser.version(),cases:results.cases.map(c=>c.id),unsupportedPacketRejected:true,classicScripts:true,errors,scope:'HR-00 saved-state contract check; no visual or performance certification'};
 if(process.env.IB075_HR00_OUTPUT){fs.mkdirSync(process.env.IB075_HR00_OUTPUT,{recursive:true});fs.writeFileSync(path.join(process.env.IB075_HR00_OUTPUT,'hr00-browser-contracts.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});}console.log(JSON.stringify(report));
}finally{await browser?.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
