(async function(){
'use strict';
const bar=document.createElement('div');bar.id='p1-review-controls';bar.style.cssText='position:fixed;right:14px;bottom:64px;z-index:10000;max-width:min(560px,calc(100vw - 60px));padding:12px 16px;background:#101d19e8;color:#effbef;border:1px solid #92bba2;border-radius:8px;font:14px system-ui;box-shadow:0 2px 12px #0008';
const label=document.createElement('div');label.textContent='Meadow P1 r2 · isolated prototype · acceptance gates unchanged';bar.append(label);
const status=document.createElement('div');status.style.cssText='font-size:12px;margin-top:5px';status.textContent='Preparing the ordinary app…';bar.append(status);document.body.append(bar);
try{
 while(!window.SphereLoading?.ready){if(window.SphereLoading?.error)throw Error(SphereLoading.error);await new Promise(r=>setTimeout(r,100));}
 const script=document.createElement('script');script.src='prototype/canopy-p1.js';document.head.append(script);await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Prototype script failed'));});
 await SphereMeadowPrototype.install(SphereApp.renderer);SphereMeadowPrototype.select('p1');
 const controls=document.createElement('div');controls.style.marginTop='8px';
 for(const [mode,text]of [['baseline','Current canopy'],['p1','P1 atlas canopy']]){
  const button=document.createElement('button');button.textContent=text;button.style.cssText='padding:5px 9px;margin-right:6px;border:1px solid #8eaf99;border-radius:4px;cursor:pointer';
  button.onclick=()=>{SphereMeadowPrototype.select(mode);SphereApp.draw();status.textContent=(mode==='p1'?'P1':'Current')+' selected. Use Explore → Watershed → Open meadow → Meadow study → Visit.';};controls.append(button);
 }
 bar.append(controls);status.textContent='P1 selected. Use Explore → Watershed → Open meadow → Meadow study → Visit.';
 SphereApp.draw();
}catch(error){status.textContent=error.message;bar.style.borderColor='#e4958f';}
})();
