const {chromium}=require(process.env.SPHERE_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SPHERE_BROWSER});try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],records=[],dir='work/screenshots/shade-body-03';fs.mkdirSync(dir,{recursive:true});page.setDefaultTimeout(240000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8766/');await page.waitForFunction(()=>window.SphereLoading?.ready);await page.evaluate(()=>SphereApp.setBusy(true));console.log('Renderer ready');
 for(const shape of ['disk','square','cap','trimmed'])for(const broken of [false,true]){
  const result=await page.evaluate(async({shape,broken})=>{
   const M=SphereMath,C=SphereCollection,E=SphereEdges,B=SphereShadeEdges,R=SphereApp.renderer;
   const s={...M.defaultState(),collection:true,shadeShape:shape,era:'after',siteId:'',siteAnchor:null,shadeAttachment:null,playing:false,time:134199,atmosphere:0,cavityHaze:0,clouds:false,localShadows:0,antialias:0,textureDetail:true};
   const p=C.plates(s).find(p=>p.id===(broken?0:4)),f=B.arrivalFrame(s,p),at=E.plateVector(f.origin,p),up=E.plateVector(f.up,p),inside=E.plateVector(f.inward,p),along=E.plateVector(f.tangent,p);
   s.position=M.add(M.add(at,M.mul(inside,-.3)),M.mul(up,-.09));s.forward=inside;s.up=up;s.fov=30;
   E.setView(1280);SphereEdgeStreaming.dispose();const coldStart=performance.now(),cold=SphereEdgeStreaming.geometry(s);const coldMs=performance.now()-coldStart;
   // Middle of the side wall spans the entire image, across the local wrap or
   // chunk seam. Any background pixel here is a hole, not a silhouette.
   const sample=(state,exportFrame=true)=>{R.draw({...state,viewMode:'objectid'},160,90,{exportFrame});const gl=R.gl,pixels=new Uint8Array(160*90*4);gl.readPixels(0,0,160,90,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let leaks=0;for(let y=10;y<80;y++)for(let x=0;x<160;x++){const i=(y*160+x)*4;if(pixels[i+1]<150)leaks++;}return leaks;};
   const coldLeaks=sample(s,false),leaks=sample(s);await R.prepare(s);if(![3,4].every(i=>R.worldTextures.status[i]==='ready'))throw Error('Unselected edge approach must prepare both Shade artworks');
   const corners=[];if(!broken&&(shape==='square'||shape==='trimmed'))for(const c of B.curves(p)){
    const point=E.plateVector(E.canonicalPoint(s,p,...c.at(c.lo)),p),normal=shape==='trimmed'?M.norm(point):p.normal,delta=M.sub(M.mul(p.center,s.radius),point),direction=M.norm(M.sub(delta,M.mul(normal,M.dot(delta,normal)))),pose={...s,position:M.add(M.add(point,M.mul(direction,-.3)),M.mul(normal,.09)),forward:direction,up:M.mul(normal,-1)};
    corners.push({boundary:c.id,leaks:sample(pose)});
   }
   const art={...s,fov:75,position:M.add(M.add(at,M.mul(inside,-.32)),M.mul(up,.06)),forward:M.norm(M.add(M.add(inside,M.mul(along,.55)),M.mul(up,-.25)))};art.up=M.basis(art.forward,up).u;
   R.draw(art,1280,720,{exportFrame:true});const image=R.canvas.toDataURL();
   const underside={...art,position:M.add(M.add(at,M.mul(inside,-.32)),M.mul(up,-.24)),forward:M.norm(M.add(M.add(inside,M.mul(along,.55)),M.mul(up,.25)))};underside.up=M.basis(underside.forward,up).u;R.draw(underside,1280,720,{exportFrame:true});const bottom=R.canvas.toDataURL();
   const shapes=SphereSites.geometry(s).filter(m=>m.parentId===p.id),before=shapes.map(m=>m.streamKey);
   const turned={...s,forward:M.mul(s.forward,-1)};const after=SphereSites.geometry(turned).filter(m=>m.parentId===p.id).map(m=>m.streamKey);
   return {shape,broken,leaks,coldLeaks,corners,coldMs,coldGroups:cold.length,groups:shapes.length,vertices:shapes.reduce((sum,m)=>sum+m.count,0),sameOnTurn:JSON.stringify(before)===JSON.stringify(after),error:R.error(),image,bottom,state:art,stream:SphereEdgeStreaming.info};
  },{shape,broken});
  const stem=dir+'/'+shape+'-'+(broken?'broken':'intact');for(const [key,suffix]of [['image',''],['bottom','-underside']]){fs.writeFileSync(stem+suffix+'.png',Buffer.from(result[key].split(',')[1],'base64'));delete result[key];}
  records.push(result);fs.writeFileSync(dir+'/verification.json',JSON.stringify({records,errors},null,2));console.log(JSON.stringify({shape,broken,leaks:result.leaks,coldMs:result.coldMs,groups:result.groups}));
  assert.equal(result.leaks,0,'No background through a joined side wall');assert.equal(result.coldLeaks,0,'No cold preview gap while fine details load');for(const c of result.corners)assert.equal(c.leaks,0,'No opening where curved or straight edge sections meet: '+c.boundary);assert(result.coldGroups>0);assert(result.sameOnTurn);assert.equal(result.error,0);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
