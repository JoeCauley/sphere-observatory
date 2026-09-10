(function(root){
'use strict';
class PreviewQuality {
 constructor(){this.scale=1;this.slow=0;this.fast=0;this.lastChange=-Infinity;}
 update(gpuMs,targetMs,now){if(!Number.isFinite(gpuMs)||gpuMs<=0)return this.scale;
  this.slow=gpuMs>targetMs*.85?this.slow+1:0;this.fast=gpuMs<targetMs*.48?this.fast+1:0;
  if(now-this.lastChange<1000)return this.scale;
  if(this.slow>=8){this.scale=Math.max(.5,Math.round(this.scale*.9*100)/100);this.slow=0;this.lastChange=now;}
  else if(this.fast>=45&&this.scale<1){this.scale=Math.min(1,Math.round((this.scale+.05)*100)/100);this.fast=0;this.lastChange=now;}
  return this.scale;
 }
}
root.SpherePreviewQuality=PreviewQuality;
})(typeof window==='undefined'?globalThis:window);
