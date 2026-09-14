// Run the existing suites sequentially in fresh, isolated browser contexts.
// Reuse the browser process so repeated tests can reuse the driver's shader
// binaries; pages, storage, application caches and workers never cross suites.
const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),path=require('node:path'),fs=require('node:fs');
(async()=>{
 const launch=chromium.launch.bind(chromium),browser=await launch({headless:true,executablePath:process.env.SPHERE_BROWSER}),records=[];
 try{for(const file of process.argv.slice(2)){
  const contexts=[];let finish;const done=new Promise(r=>finish=r),start=Date.now();process.exitCode=0;
  chromium.launch=async()=>({
   async newContext(options){const context=await browser.newContext(options);contexts.push(context);return context;},
   async newPage(options){const context=await this.newContext(options);return context.newPage();},
   async close(){await Promise.all(contexts.map(c=>c.close()));finish();}
  });
  console.log('GATE START '+file);delete require.cache[require.resolve(path.resolve(file))];require(path.resolve(file));await done;await new Promise(setImmediate);
  records.push({file,exitCode:process.exitCode||0,elapsedMs:Date.now()-start});console.log('GATE END '+JSON.stringify(records.at(-1)));
  fs.mkdirSync('work/screenshots/continuity-03/regressions',{recursive:true});fs.writeFileSync('work/screenshots/continuity-03/regressions/'+(process.env.SPHERE_GATE_LABEL||'browser-gates')+'.json',JSON.stringify(records,null,2));
 }}finally{chromium.launch=launch;await browser.close();}
 process.exitCode=records.some(r=>r.exitCode)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
