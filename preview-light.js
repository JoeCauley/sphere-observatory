(function(root){
'use strict';
const keys=['era','seed','regionOrder','colorRichness','multipleWounds','routeShades','starStation','stationSamples','cycleScale','luminosity','radius','starRadius','shadeShape','shadeTrim','biome','layoutVersion','axisLat','axisLon','waistWidth','transitionKm'];
const workerURL=new URL('shine-worker.js',document.currentScript.src);
class PreviewLight {
 constructor(){this.key='';this.color=null;this.target=null;this.pending=false;this.lastSent=-Infinity;this.lastTime=null;this.sampleTime=null;
  try{this.worker=new Worker(workerURL);
   this.worker.onmessage=({data})=>{this.pending=false;if(data.key===this.key&&data.time===this.lastTime){this.target=data.color;this.sampleTime=data.time;root.dispatchEvent(new Event('sphere-light-ready'));}};
   this.worker.onerror=()=>{this.worker.terminate();this.worker=null;this.pending=false;};
  }catch{this.worker=null;}
 }
 sample(s){const now=performance.now(),key=keys.map(k=>s[k]).join('|');
  if(key!==this.key){this.key=key;this.color=SphereCollection.cavity(s).slice();this.target=this.color.slice();this.lastTime=s.time;this.sampleTime=s.time;this.lastSent=now;}
  if(!s.playing&&s.time!==this.lastTime){this.color=SphereCollection.cavity(s).slice();this.target=this.color.slice();this.lastTime=s.time;this.sampleTime=s.time;return this.color;}
  if(s.time!==this.lastTime&&!this.pending&&now-this.lastSent>=100){this.lastSent=now;this.lastTime=s.time;
   if(this.worker){this.pending=true;this.worker.postMessage({state:s,key});}
   else{this.target=SphereCollection.cavity(s).slice();this.sampleTime=s.time;}
  }
  const blend=1-Math.exp(-Math.min(100,now-(this.lastBlend??now))/80);this.lastBlend=now;
  this.color=this.color.map((v,i)=>v+(this.target[i]-v)*blend);
  // Finish a paused view exactly when its worker result arrives.
  if(!s.playing&&this.sampleTime===s.time)this.color=this.target.slice();
  return this.color;
 }
 dispose(){this.worker?.terminate();this.worker=null;this.pending=false;}
}
root.SpherePreviewLight=PreviewLight;
})(window);
