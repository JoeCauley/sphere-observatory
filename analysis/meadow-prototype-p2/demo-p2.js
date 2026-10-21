(async function(){
'use strict';
const bar=document.createElement('div');bar.style.cssText='position:fixed;right:14px;bottom:64px;z-index:10000;max-width:min(640px,calc(100vw - 40px));padding:12px 16px;background:#14241eef;color:#effbef;border:1px solid #92bba2;border-radius:8px;font:14px system-ui';
const title=document.createElement('div');title.textContent='Meadow P2 · experimental appearance';bar.append(title);const status=document.createElement('p');status.textContent='Explore → Watershed → Open meadow → Meadow study → Visit';bar.append(status);document.body.append(bar);
try{
 while(!window.SphereLoading?.ready||!window.SphereApp?.renderer.meadow.productionPopulation?.service.gpuBackend||!SphereMeadowCanopy.isF2(SphereApp.getState())){if(window.SphereLoading?.error)throw Error(SphereLoading.error);await new Promise(r=>setTimeout(r,100));}
 for(const name of ['canopy-p1.js','canopy-p2.js','tile-planner-p1.js','submission-p2.js','capture-p2.js']){const script=document.createElement('script');script.src='prototype/'+name;await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Experiment script failed'));document.head.append(script);});}
 await SphereMeadowPrototype.install(SphereApp.renderer);SphereMeadowPrototype.select('volume12');const controls=document.createElement('div');controls.style.cssText='display:flex;flex-wrap:wrap;gap:6px';
 for(const [mode,text]of [['baseline','Current'],['p1','P1 atlas'],['volume12','12 stems'],['volume18','18 stems'],['volume24','24 stems']]){const b=document.createElement('button');b.textContent=text;b.onclick=()=>{SphereMeadowPrototype.select(mode);SphereApp.draw();status.textContent=text+' selected. Visual and performance acceptance remain open.';};controls.append(b);}bar.append(controls);
 const C=new SphereMeadowSubmissionP2.CompiledSubmission(SphereApp.renderer.meadow.productionPopulation),label=document.createElement('label'),checkbox=document.createElement('input');checkbox.type='checkbox';label.style.cssText='display:block;margin-top:10px';label.append(checkbox,' Use compiled submission');checkbox.onchange=()=>{C.select(checkbox.checked);SphereApp.draw();};bar.append(label);status.textContent='12 stems selected. Visual and performance acceptance remain open.';SphereApp.draw();
}catch(error){status.textContent=error.message;}
})();
