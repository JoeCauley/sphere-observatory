'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{chromium}=require('playwright'),cfg=require('./last-run.json');
const out=path.join(cfg.evidence,'review-check-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out);fs.copyFileSync(__filename,path.join(out,'source.cjs'));process.env.TEMP=path.join(cfg.work,'browser-temp');process.env.TMP=process.env.TEMP;process.env.TMPDIR=process.env.TEMP;
(async()=>{let browser;try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1280,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:60546/review');await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth===1920));
 const normal=await page.evaluate(()=>({title:document.title,options:document.querySelector('#pose').options.length,images:[...document.images].map(i=>({src:i.src,width:i.naturalWidth,height:i.naturalHeight}))}));
 assert.equal(normal.options,7);await page.screenshot({path:path.join(out,'normal-viewer.png')});
 await page.selectOption('#pose','elevated-turn');await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth===1920&&i.src.includes('elevated-turn')));
 await page.screenshot({path:path.join(out,'elevated-viewer.png')});assert.deepEqual(errors,[]);
 const bytes=fs.readFileSync(path.join(cfg.evidence,'review.html')),report={schema:1,status:'PASS_STATIC_REVIEW_UI',browser:browser.version(),normal,errors,htmlSha256:crypto.createHash('sha256').update(bytes).digest('hex'),scope:'Owned static review rendering/selector/image-loading check; no live-app or acceptance test'};
 fs.writeFileSync(path.join(out,'review.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({out,status:report.status}));
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
