// Capture diagnostic, including a known cold 4K repeat discrepancy on ANGLE.
// Set SPHERE_STRICT_CAPTURE=1 to fail on that discrepancy. Always retain both
// images and decoded differences; never conceal it with a warm-up frame.
const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});try{
 const page=await browser.newPage(),errors=[],dir='work/screenshots/shade-boundary-01';fs.mkdirSync(dir,{recursive:true});page.setDefaultTimeout(240000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SPHERE_URL||'http://127.0.0.1:8766/');await page.waitForFunction(()=>window.SphereLoading?.ready);await page.evaluate(()=>SphereApp.setBusy(true));
 const result=await page.evaluate(async()=>{
  const M=SphereMath,C=SphereCollection,E=SphereEdges,B=SphereShadeEdges,R=SphereApp.renderer;
  const s={...M.defaultState(),collection:true,era:'after',shadeShape:'cap',time:91451,playing:false,siteId:'',siteAnchor:null,shadeAttachment:null,atmosphere:0,cavityHaze:0,clouds:false,antialias:3,textureDetail:true,geometryDetail:true};
  function pose(time){const state={...s,time},p=C.plates(state).find(p=>p.id===7),curve=B.curves(p).find(c=>c.id==='long-1'),f=B.frame(state,p,curve,-.95),at=E.plateVector(f.origin,p),up=E.plateVector(f.up,p),inside=E.plateVector(f.inward,p),along=E.plateVector(f.tangent,p);state.position=M.add(M.add(at,M.mul(inside,-.3)),M.mul(up,-.07));state.forward=M.norm(M.add(inside,M.mul(along,.4)));state.up=M.basis(state.forward,up).u;return state;}
  const initial=pose(s.time),saved=M.validate(JSON.parse(JSON.stringify(M.sceneRecord(initial).state))),records=[];
  for(const [name,width,height,projection]of [['photo',3840,2160,'perspective'],['panorama',1920,960,'panorama']]){
   const state={...saved,projection};await R.prepare(state,{aspect:width/height});R.draw(state,width,height,{exportFrame:true});const first=R.canvas.toDataURL();R.draw(state,width,height,{exportFrame:true});
   const repeat=R.canvas.toDataURL();let difference=null;if(first!==repeat){const pixels=[];for(const url of [first,repeat]){const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');context.drawImage(img,0,0);pixels.push(context.getImageData(0,0,width,height).data);}let changed=0,max=0,total=0;const bounds=[width,height,0,0];for(let i=0;i<pixels[0].length;i+=4){let hit=false;for(let c=0;c<3;c++){const delta=Math.abs(pixels[0][i+c]-pixels[1][i+c]);hit||=delta>0;max=Math.max(max,delta);total+=delta;}if(hit){changed++;const x=i/4%width,y=Math.floor(i/4/width);bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}}difference={changed,max,total,bounds};}
   records.push({name,width,height,equal:first===repeat,difference,image:first,repeat,render:{...R.renderInfo},groups:SphereSites.geometry(state).filter(m=>m.parentId===7).length,error:R.error()});
  }
  await R.prepare(initial);R.draw(initial,1280,720,{exportFrame:true});const before=R.canvas.toDataURL();const moved=pose(s.time+600);await R.prepare(moved);R.draw(moved,1280,720,{exportFrame:true});const changed=before!==R.canvas.toDataURL();R.draw(saved,1280,720,{exportFrame:true});
  const ext=R.gl.getExtension('WEBGL_debug_renderer_info');return {records,changed,restoreEqual:before===R.canvas.toDataURL(),state:saved,error:R.error(),device:ext?R.gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):R.gl.getParameter(R.gl.RENDERER)};
 });
 for(const r of result.records){fs.writeFileSync(dir+'/structure-'+r.name+'.png',Buffer.from(r.image.split(',')[1],'base64'));fs.writeFileSync(dir+'/structure-'+r.name+'-repeat.png',Buffer.from(r.repeat.split(',')[1],'base64'));delete r.image;delete r.repeat;console.log(r.name,r.equal,r.difference);}
 fs.writeFileSync(dir+'/capture-verification.json',JSON.stringify({...result,errors},null,2));assert.deepEqual(errors,[]);assert.equal(result.error,0);assert(result.changed);assert(result.restoreEqual);
 for(const r of result.records){if(process.env.SPHERE_STRICT_CAPTURE==='1')assert(r.equal,r.name+' first/repeat export mismatch');assert(r.groups>0);assert.equal(r.error,0);}
 console.log('Capture diagnostic complete; exact first/repeat results:',result.records.map(r=>({name:r.name,equal:r.equal,difference:r.difference})));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
