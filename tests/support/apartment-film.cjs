const fs=require('node:fs'),path=require('node:path');
// Capture the running browser. Every filename is the elapsed time on the route clock.
async function recordPage(page,folder,startTime) {
  const client=await page.context().newCDPSession(page);fs.mkdirSync(folder,{recursive:true});
  let previous=-Infinity;
  client.on('Page.screencastFrame',frame=>{
    void client.send('Page.screencastFrameAck',{sessionId:frame.sessionId}).catch(()=>{});
    const t=Date.now()-startTime;if(t-previous<72)return;previous=t;
    fs.writeFileSync(path.join(folder,String(t).padStart(9,'0')+'.jpg'),Buffer.from(frame.data,'base64'));
  });
  await client.send('Page.startScreencast',{format:'jpeg',quality:82,maxWidth:1440,maxHeight:900,everyNthFrame:2});
  return async()=>{await client.send('Page.stopScreencast').catch(()=>{});await client.detach().catch(()=>{});};
}
module.exports={recordPage};
