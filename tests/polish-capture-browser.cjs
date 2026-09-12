const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');

// Photograph export uses stored ZIP entries (no compression or data descriptor).
function files(bytes){
 const out={};let p=0;
 while(p+30<=bytes.length&&bytes.readUInt32LE(p)===0x04034b50){
  assert.equal(bytes.readUInt16LE(p+6)&8,0,'Expected entry sizes in the ZIP header');
  assert.equal(bytes.readUInt16LE(p+8),0,'Expected stored ZIP entries');
  const size=bytes.readUInt32LE(p+18),n=bytes.readUInt16LE(p+26),extra=bytes.readUInt16LE(p+28);
  const name=bytes.subarray(p+30,p+30+n).toString(),start=p+30+n+extra;
  assert(start+size<=bytes.length,'Truncated ZIP entry');
  out[name]=bytes.subarray(start,start+size);p=start+size;
 }
 return out;
}

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});
 try{
  const page=await browser.newPage({acceptDownloads:true}),errors=[];
  page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SphereSession);
  const state=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/polish-scenes.json'),'utf8')).find(x=>x.id==='rim-air').state;
  await page.evaluate(s=>{SphereApp.setBusy(true);SphereApp.setState(s);document.getElementById('exportSize').value='3840';},state);
  const outputs=[];
  for(let i=0;i<2;i++){
   const next=page.waitForEvent('download');
   await page.evaluate(async()=>{SphereApp.setBusy(false);await SphereApp.capture();SphereApp.setBusy(true);});
   const dl=await next;outputs.push(files(fs.readFileSync(await dl.path())));
  }
  const dir=path.join(__dirname,'../work/screenshots/polish/4k');fs.mkdirSync(dir,{recursive:true});
  const repeatMatches=outputs[0]['photograph.png'].equals(outputs[1]['photograph.png']);
  if(!repeatMatches){
   for(let i=0;i<outputs.length;i++){fs.writeFileSync(path.join(dir,'capture-'+i+'.png'),outputs[i]['photograph.png']);fs.writeFileSync(path.join(dir,'capture-'+i+'-scene.json'),outputs[i]['scene.json']);}
   const difference=await page.evaluate(async urls=>{
    const pixels=[];for(const url of urls){const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);pixels.push(ctx.getImageData(0,0,c.width,c.height).data);}
    let changed=0,max=0,total=0,minX=3840,minY=2160,maxX=-1,maxY=-1;
    for(let i=0;i<pixels[0].length;i+=4){let diff=false;for(let c=0;c<3;c++){const d=Math.abs(pixels[0][i+c]-pixels[1][i+c]);max=Math.max(max,d);total+=d;diff||=d>0;}if(diff){changed++;const x=i/4%3840,y=Math.floor(i/4/3840);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
    return {changed,max,total,bounds:[minX,minY,maxX,maxY]};
   },outputs.map(o=>'data:image/png;base64,'+o['photograph.png'].toString('base64')));
   difference.sameState=JSON.stringify(JSON.parse(outputs[0]['scene.json']).state)===JSON.stringify(JSON.parse(outputs[1]['scene.json']).state);
   fs.writeFileSync(path.join(dir,'capture-difference.json'),JSON.stringify(difference,null,2));console.log('Capture difference',difference);
  }
  assert(repeatMatches);
  const meta=JSON.parse(outputs[0]['scene.json']);
  assert.equal(meta.image.width,3840);assert.equal(meta.image.render.silhouetteSamples,8);
  const error=await page.evaluate(()=>SphereApp.renderer.error());assert.equal(error,0);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(dir,'photograph-verification.json'),JSON.stringify({repeatMatches:true,bytes:outputs[0]['photograph.png'].length,image:meta.image,error,errors},null,2));
  console.log('PASS actual 4K photograph ZIP exports repeat identically');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
