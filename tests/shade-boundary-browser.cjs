// Compare the rendered body with independent CPU ray/footprint queries. Material
// averages alone cannot detect missing kilometres of skin at an unselected edge.
const coverageOnly=process.env.SPHERE_COVERAGE_ONLY==='1';
const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});try{
 const page=await browser.newPage({viewport:{width:1280,height:960}}),errors=[],records=[],dir=coverageOnly?'work/screenshots/shade-body-coverage':'work/screenshots/shade-boundary-01';fs.mkdirSync(dir,{recursive:true});page.setDefaultTimeout(240000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/');await page.waitForFunction(()=>window.SphereLoading?.ready);await page.evaluate(()=>SphereApp.setBusy(true));
 const fixtures=['disk','square','cap','trimmed'].flatMap(shape=>[9,0,7,8].flatMap(id=>[1,-1].map(side=>({shape,id,side}))));
 for(const shape of ['disk','square','cap','trimmed'])for(const side of [1,-1])fixtures.push({shape,id:7,side,boundary:'hole'});
 fixtures.push({shape:'cap',id:7,side:1,boundary:'long-1'});
 for(const {shape,id,side,boundary}of fixtures){
  const result=await page.evaluate(async({shape,id,side,boundary,coverageOnly})=>{
   const M=SphereMath,C=SphereCollection,E=SphereEdges,B=SphereShadeEdges,R=SphereApp.renderer,gl=R.gl;
   const s={...M.defaultState(),collection:true,era:id===9?'before':'after',shadeShape:shape,time:91451,playing:false,siteId:'',siteAnchor:null,shadeAttachment:null,atmosphere:0,cavityHaze:0,clouds:false,fov:78,antialias:0,localShadows:0,geometryDetail:false};
   const p=C.plates(s).find(p=>p.id===id),requested=boundary||(id===9?(shape==='square'?'east':shape==='trimmed'?'east-trim':'perimeter'):id===0?'long-1':id===7?'loss-bank':'cross-1'),curve=B.curves(p).find(c=>requested==='hole'?c.id.startsWith('hole-')&&B.frame(s,p,c,.5):c.id===requested),name=curve?.id;
   let f;for(let i=1;i<40&&!f;i++)f=B.frame(s,p,curve,curve.lo+(curve.hi-curve.lo)*i/40);if(!f)throw Error('Missing boundary fixture '+name);
   const at=E.plateVector(f.origin,p),up=E.plateVector(f.up,p),inside=E.plateVector(f.inward,p),along=E.plateVector(f.tangent,p);
   s.position=M.add(M.add(at,M.mul(up,side*5.2)),M.mul(inside,6));s.forward=M.norm(M.add(M.add(along,M.mul(inside,-.7)),M.mul(up,-side*.16)));s.up=M.basis(s.forward,M.mul(up,side)).u;
   const w=160,h=144;R.draw({...s,viewMode:'objectid'},w,h,{exportFrame:true});const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   const basis=M.basis(s.forward,s.up),cpu=new Uint8Array(w*h),gpu=new Uint8Array(w*h);let mismatch=0,interior=0,shadePixels=0;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=y*w+x,d=M.ray((x+.5)/w*2-1,(y+.5)/h*2-1,w/h,s.fov,basis);cpu[k]=M.trace(s.position,d,s).kind==='Shade'?1:0;gpu[k]=Math.abs(pixels[k*4]-64)<2?1:0;shadePixels+=cpu[k];if(cpu[k]!==gpu[k])mismatch++;}
   for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const k=y*w+x;if(cpu[k]!==gpu[k]&&[-w-1,-w,-w+1,-1,1,w-1,w,w+1].every(d=>cpu[k+d]===cpu[k]))interior++;}
   const saved=M.validate(M.sceneRecord(s).state);if(saved.shadeGeometryRevision!==s.shadeGeometryRevision||saved.time!==s.time)throw Error('Scene changed during fixture');
   let image=null,repeat=null,repeated=null,difference=null;if(!coverageOnly&&shape==='cap'&&side===1){await R.prepare(s);R.draw({...s,antialias:3},1280,960,{exportFrame:true});image=R.canvas.toDataURL();R.draw({...s,antialias:3},1280,960,{exportFrame:true});repeated=R.canvas.toDataURL();repeat=image===repeated;
    if(!repeat){const samples=[];for(const url of [image,repeated]){const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=1280;c.height=960;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);samples.push(ctx.getImageData(0,0,1280,960).data);}let changed=0,max=0;const bounds=[1280,960,0,0];for(let i=0;i<samples[0].length;i+=4){let hit=false;for(let c=0;c<3;c++){const d=Math.abs(samples[0][i+c]-samples[1][i+c]);hit||=d>0;max=Math.max(max,d);}if(hit){changed++;const x=i/4%1280,y=Math.floor(i/4/1280);bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}}difference={changed,max,bounds};}
   }
   return {shape,id,side,name,mismatch,interior,shadePixels,pixels:w*h,repeat,image,repeated,difference,error:R.error(),state:s};
  },{shape,id,side,boundary,coverageOnly});
  const stem=dir+'/'+shape+'-'+id+'-'+side+'-'+result.name;
  if(result.image){fs.writeFileSync(stem+'.png',Buffer.from(result.image.split(',')[1],'base64'));delete result.image;}
  if(result.repeated){fs.writeFileSync(stem+'-repeat.png',Buffer.from(result.repeated.split(',')[1],'base64'));delete result.repeated;}
  records.push(result);fs.writeFileSync(dir+'/verification.json',JSON.stringify({records,errors},null,2));console.log(JSON.stringify({shape,id,side,mismatch:result.mismatch,interior:result.interior,shadePixels:result.shadePixels,difference:result.difference}));
  assert.equal(result.error,0);assert(result.shadePixels>50);assert.equal(result.interior,0,'Missing/excess skin away from an actual boundary');assert(result.mismatch<=24,'Boundary agreement must stay within isolated output pixels');if(result.repeat!==null)assert(result.repeat);
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/verification.json',JSON.stringify({records,errors},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
