(function(){
'use strict';const A=SphereAtlasStudy,M=SphereMath,W=SphereWorld,C=SphereCollection,s={...M.defaultState(),collection:true,era:'after'},$=id=>document.getElementById(id),maps=new Map(),imageCache=new Map(),provinceCache=new Map();
const seeds={forest:713,industrial:827,boundary:713,'wound-a':341,'wound-b':902};let current=null;
const rgb=c=>c.map(v=>Math.round(Math.pow(Math.max(0,Math.min(1,v)),1/2.2)*255));
const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
for(const candidate of A.candidates){const article=document.createElement('article');article.className='candidate'+(candidate.id==='watershed'?' recommended':'');article.innerHTML=`<span class="tag">${candidate.tag}</span><h2>${candidate.name}</h2><p class="description">${candidate.description}</p>`;
 for(const [view,label,scale]of [['overview','Whole-shell atlas','Waist-relative projection'],['province','Province approach','640 km wide'],['district','Local district','96 km wide']]){const figure=document.createElement('figure');figure.innerHTML=`<canvas width="480" height="300" aria-label="${candidate.name}: ${label}" role="img"></canvas><figcaption><span class="map-name">${label}</span><span>${scale}</span></figcaption>`;article.append(figure);const canvas=figure.querySelector('canvas');if(view==='overview'){canvas.width=320;canvas.height=200;}maps.set(candidate.id+':'+view,canvas);}$('comparison').append(article);
}
function image(canvas,sample,cacheKey){const ctx=canvas.getContext('2d'),{width:w,height:h}=canvas;if(cacheKey&&imageCache.has(cacheKey)){ctx.putImageData(imageCache.get(cacheKey),0,0);return ctx;}const data=ctx.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=sample((x+.5)/w,(y+.5)/h),i=(y*w+x)*4;data.data[i]=c[0];data.data[i+1]=c[1];data.data[i+2]=c[2];data.data[i+3]=255;}ctx.putImageData(data,0,0);if(cacheKey)imageCache.set(cacheKey,data);return ctx;}
function overview(candidate,anchor,layer){const canvas=maps.get(candidate+':overview'),ctx=image(canvas,(u,v)=>{const lon=(u-.5)*Math.PI*2,lat=(.5-v)*Math.PI,field=A.macro(candidate,lat,lon,s);if(field.missing)return [9,17,19];let col=rgb(field.color);if(layer==='water')col=mix(col,[30,48,49],.6);if(layer==='service')col=field.region.id>=10?mix(col,[181,153,113],.4):mix(col,[29,46,42],.65);if(layer==='damage')col=mix(col,[104,115,99],.5);return col;},candidate+':'+layer);
 ctx.strokeStyle='#c2c99e55';ctx.lineWidth=1;ctx.setLineDash([6,7]);for(const lat of [-s.waistWidth*2/3,0,s.waistWidth*2/3]){const y=(.5-lat/180)*canvas.height;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}ctx.setLineDash([]);
 const p=W.coordinates(anchor,s),x=(p.lon/(2*Math.PI)+.5)*canvas.width,y=(.5-p.lat/Math.PI)*canvas.height;ctx.strokeStyle='#fff0b5';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x-11,y);ctx.lineTo(x+11,y);ctx.moveTo(x,y-11);ctx.lineTo(x,y+11);ctx.stroke();ctx.fillStyle='#d2ded1';ctx.font='16px Segoe UI';ctx.fillText('N · polar service',14,24);ctx.fillText('S · polar service',14,canvas.height-14);
}
function interpolate(array,p,u,v){const x=M.clamp(u,0,1)*(p.n-1),y=M.clamp(v,0,1)*(p.n-1),ix=Math.min(p.n-2,Math.floor(x)),iy=Math.min(p.n-2,Math.floor(y)),a=x-ix,b=y-iy,i=iy*p.n+ix;return array[i]*(1-a)*(1-b)+array[i+1]*a*(1-b)+array[i+p.n]*(1-a)*b+array[i+p.n+1]*a*b;}
function local(candidate,view,region,layer,p,anchor){
 const canvas=maps.get(candidate+':'+view),extent=view==='province'?1:.15,focus=p.focus,center=view==='province'?[.5,.5]:[M.clamp(focus.u,.1,.9),M.clamp(focus.v,.1,.9)],left=center[0]-extent/2,top=center[1]-extent*.625/2;
 const ground=W.sample(anchor,s),base=rgb(ground.color),qFrame=M.basis(anchor),wound=region.startsWith('wound'),near=wound?W.nearestRim(anchor,s):null,frame=wound?W.rimFrame(s,near.index,near.t):null;
 const qAt=(u,v)=>M.norm(M.add(anchor,M.add(M.mul(frame?.tangent||qFrame.r,(u-.5)*p.extentKm/s.radius),M.mul(frame?.inland||qFrame.u,(.5-v)*p.extentKm/s.radius))));
 if(wound&&!p.damage){p.damage=new Float64Array(p.n*p.n);for(let y=0;y<p.n;y++)for(let x=0;x<p.n;x++)p.damage[y*p.n+x]=W.woundDistance(qAt(x/(p.n-1),y/(p.n-1)),s);}
 const localData={left,top,extent,center};canvas.dataset.view=JSON.stringify(localData);
 const ctx=image(canvas,(x,y)=>{const u=left+x*extent,v=top+y*extent*.625,h=interpolate(p.height,p,u,v),filled=interpolate(p.filled,p,u,v),water=filled-h>.0025;
  let col=candidate==='current'?base:mix([47,73,53],[150,152,111],M.clamp((h-.3)*1.15,0,1));
  if(wound&&candidate!=='current')col=rgb(mix(W.palette[ground.a],W.palette[ground.b],ground.blend)).map(c=>c*(.8+h*.3));
  if(region==='industrial')col=candidate==='current'?base:mix([67,83,75],[161,142,112],M.clamp(h*.75,0,1));
  if(region==='boundary'&&u>.48+.035*Math.sin(v*12))col=mix(col,[180,156,105],.65);
  if(candidate==='current'){const grid=Math.min((u*28)%1,(v*28)%1);col=col.map(c=>c*(grid<.055?.69:.88+.18*A.noise(u*170,v*170,p.seed)));}
  else{const relief=(interpolate(p.height,p,u-.003,v-.003)-interpolate(p.height,p,u+.003,v+.003))*8,grain=A.noise(u*420,v*420,p.seed)*.12;col=col.map(c=>c*M.clamp(.91+relief+grain,.5,1.3));}
  if(layer==='water')col=mix(col,[37,53,48],.6);if(layer==='service')col=mix(col,[41,53,47],.4);
  if(candidate!=='current'&&water)col=layer==='damage'?mix(col,[64,112,105],.5):[57,102,99];
  if(wound){const distance=interpolate(p.damage,p,u,v);if(distance<0)return [7,15,18];const damage=W.woundBlend(distance);col=mix(col,layer==='damage'?[159,84,64]:[144,130,112],damage*.8);}
  else if(layer==='damage')col=mix(col,[85,111,91],.6);
  return col;
 });
 const pos=(u,v)=>[(u-left)/extent*canvas.width,(v-top)/(extent*.625)*canvas.height],line=(a,b,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(...pos(...a));ctx.lineTo(...pos(...b));ctx.stroke();};
 ctx.save();if(wound){const boundary=.5+120/640,pixel=pos(.5,boundary)[1];ctx.beginPath();ctx.rect(0,0,canvas.width,Math.max(0,pixel));ctx.clip();}
 if(candidate!=='current'&&layer!=='service'){
  ctx.lineCap='round';ctx.lineJoin='round';for(const river of p.riverPaths){const km=.2+Math.sqrt(river.flow)*.020;ctx.strokeStyle=layer==='damage'?'#699a91aa':'#83b1a5';ctx.lineWidth=Math.max(.6,km/(640*extent)*canvas.width);ctx.beginPath();const points=river.points.map(q=>pos(...q));ctx.moveTo(...points[0]);for(let i=1;i<points.length-1;i++){const next=points[i+1];ctx.quadraticCurveTo(...points[i],(points[i][0]+next[0])/2,(points[i][1]+next[1])/2);}ctx.lineTo(...points.at(-1));ctx.stroke();}
 }
 if(layer!=='water'&&candidate!=='current'){
  const road='#d8b771b3',width=Math.max(.7,.5/(640*extent)*canvas.width);
  if(candidate==='compartment'){for(let u=0;u<1.01;u+=.125)line([u,0],[u,1],road,width);for(let v=0;v<1.01;v+=.16)line([0,v],[1,v],road,width);}
  else if(candidate==='backbone'){const spine=v=>.52+.055*Math.sin(v*7);for(let j=0;j<64;j++)line([spine(j/64),j/64],[spine((j+1)/64),(j+1)/64],road,width*2);for(const site of p.sites)line([site.u,site.v],[spine(site.v),site.v],road,width);}
  else{const connected=[p.sites[0]],remaining=p.sites.slice(1);while(remaining.length){let pair=null,best=Infinity;for(const a of connected)for(const b of remaining){const distance=Math.hypot(a.u-b.u,a.v-b.v);if(distance<best){best=distance;pair=[a,b];}}line([pair[0].u,pair[0].v],[pair[1].u,pair[1].v],road,width);connected.push(pair[1]);remaining.splice(remaining.indexOf(pair[1]),1);}}
  for(const [i,site]of p.sites.entries()){const [x,y]=pos(site.u,site.v),size=(region==='industrial'?10:5)/(640*extent)*canvas.width;ctx.fillStyle=['#b9a581','#8eaba0','#a58d74','#b79b68'][i%4];ctx.fillRect(x-size,y-size,size*2,size*2);ctx.strokeStyle='#283931';ctx.lineWidth=.7;for(let row=0;row<3;row++)for(let col=0;col<4;col++)ctx.strokeRect(x-size+col*size*.5,y-size+row*size*.66,size*.4,size*.5);if(view==='district'&&x>10&&x<canvas.width-140&&y>30&&y<canvas.height-20){ctx.font='16px Segoe UI';ctx.fillStyle='#e5debd';ctx.fillText(site.role,x+size+7,y+5);}}
 }
 ctx.restore();
 if(view==='province'){const center=[M.clamp(focus.u,.1,.9),M.clamp(focus.v,.1,.9)],[x,y]=pos(center[0]-.075,center[1]-.075*.625);ctx.strokeStyle='#efe1a8';ctx.lineWidth=2;ctx.strokeRect(x,y,.15*canvas.width,.15*canvas.height);}
 // Cartographic scale bar; no infrastructure is enlarged in physical coordinates.
 const km=view==='province'?100:20,px=km/(640*extent)*canvas.width;ctx.fillStyle='#102221cc';ctx.fillRect(12,canvas.height-46,px+22,34);ctx.strokeStyle='#e1dbc1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(22,canvas.height-19);ctx.lineTo(22+px,canvas.height-19);ctx.stroke();ctx.fillStyle='#e1dbc1';ctx.font='15px Segoe UI';ctx.fillText(km+' km',22,canvas.height-28);
}
function draw(){const region=$('location').value,layer=$('layer').value,seed=seeds[region],p=provinceCache.get(seed)||A.province(seed),anchor=A.address(s,region),ll=M.latlon(anchor);provinceCache.set(seed,p);current={format:'sphere-atlas-design-study',revision:1,seed,region,layer,radiusKm:s.radius,axis:{latitude:s.axisLat,longitude:s.axisLon},anchor,candidateIds:A.candidates.map(c=>c.id),provinceExtentKm:p.extentKm,districtExtentKm:p.extentKm*.15};$('address').textContent=`${ll[0].toFixed(4)}° / ${ll[1].toFixed(4)}° · seed ${seed}\n1 AU · waist axis ${s.axisLat}° / ${s.axisLon}°`;
 for(const candidate of A.candidates){overview(candidate.id,anchor,layer);local(candidate.id,'province',region,layer,p,anchor);local(candidate.id,'district',region,layer,p,anchor);}window.SphereAtlasStudyView={current,province:p,ready:true};
}
$('location').addEventListener('change',draw);$('layer').addEventListener('change',draw);$('save').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(current,null,2)],{type:'application/json'}));a.href=url;a.download='sphere-atlas-study-'+current.region+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};draw();
})();
