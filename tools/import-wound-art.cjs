/* Read-only image analysis and provenance update; generated PNGs are never edited. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright');
(async()=>{const file=path.resolve('assets/wound-edges/manifest.json'),manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});try{const page=await browser.newPage();await page.goto((process.env.SPHERE_URL||'http://127.0.0.1:8766/')+'assets/wound-edges/manifest.json');
  for(const entry of manifest.images){Object.assign(entry,await page.evaluate(async entry=>{const image=new Image();image.src='/'+entry.path;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,image.width,image.height).data,mean=[0,0,0],count=data.length/4,linear=x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4;let green=0;
   for(let i=0;i<data.length;i+=4){for(let c=0;c<3;c++)mean[c]+=linear(data[i+c]/255)/count;if(data[i+1]>data[i]*1.15&&data[i+1]>data[i+2]*1.10&&data[i+1]>30)green++;}
   return {width:image.width,height:image.height,meanLinear:mean.map(x=>+x.toFixed(7)),greenPixelFraction:green/count};
  },entry));entry.bytes=fs.statSync(entry.path).size;entry.sha256=crypto.createHash('sha256').update(fs.readFileSync(entry.path)).digest('hex');console.log(entry.id,entry.width,entry.meanLinear,'green',entry.greenPixelFraction.toFixed(4));}
 }finally{await browser.close();}
 fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
 const world=path.resolve('world.js'),source=fs.readFileSync(world,'utf8'),ids=['dark-age-forest','super-jungle','ultra-desert','winter-hell','ruined-shell','machine-expanse','rust-marsh','chalk-archipelago','mycelium-sea','violet-labyrinth'],palette=ids.map(id=>{const item=manifest.images.find(x=>x.id===id);if(!item)throw Error('Missing '+id);return item.meanLinear;});
 fs.writeFileSync(world,source.replace(/^const woundPalette=.*$/m,'const woundPalette='+JSON.stringify(palette)+'; // Measured linear-sRGB means; see assets/wound-edges/manifest.json.'));
})();
