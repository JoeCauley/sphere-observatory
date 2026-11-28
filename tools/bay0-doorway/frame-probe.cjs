'use strict';
// Installed before page scripts. Query the station callback only when it submits a draw.
function instrument(){
  const P=WebGL2RenderingContext.prototype,acct={live:0,peak:0,sizes:new Map()};window.__alloc=acct;
  const add=(obj,bytes)=>{acct.live+=bytes-(acct.sizes.get(obj)||0);acct.sizes.set(obj,bytes);if(acct.live>acct.peak)acct.peak=acct.live;};
  const drop=obj=>{acct.live-=acct.sizes.get(obj)||0;acct.sizes.delete(obj);};
  const bound=new WeakMap(),binding=(gl,t)=>bound.get(gl)?.get(t);
  const remember=(gl,t,o)=>{if(!bound.has(gl))bound.set(gl,new Map());bound.get(gl).set(t,o);};
  const bb=P.bindBuffer;P.bindBuffer=function(t,b){remember(this,'b'+t,b);return bb.apply(this,arguments);};
  const units=new WeakMap(), active=P.activeTexture;
  P.activeTexture=function(unit){units.set(this,unit);return active.apply(this,arguments);};
  const textureKey=(gl,target)=>'t'+(units.get(gl)??gl.TEXTURE0)+'/'+target;
  const bt=P.bindTexture;P.bindTexture=function(t,x){remember(this,textureKey(this,t),x);return bt.apply(this,arguments);};
  const br=P.bindRenderbuffer;P.bindRenderbuffer=function(t,x){remember(this,'r',x);return br.apply(this,arguments);};
  const bd=P.bufferData;P.bufferData=function(t,src,u,off=0,len=0){const r=bd.apply(this,arguments),b=binding(this,'b'+t);
    if(b)add(b,typeof src==='number'?src:len?len*(src.BYTES_PER_ELEMENT||1):((src?.byteLength||0)-off*(src?.BYTES_PER_ELEMENT||1)));return r;};
  const ts=P.texStorage2D;P.texStorage2D=function(t,l,f,w,h){const r=ts.apply(this,arguments),x=binding(this,textureKey(this,t));if(x)add(x,w*h*4);return r;};
  const ti=P.texImage2D;P.texImage2D=function(t,level){const r=ti.apply(this,arguments),x=binding(this,textureKey(this,t));if(x&&level===0){
    const a=arguments,w=typeof a[3]==='number'&&a.length>=9?a[3]:(a[5]?.width??a[5]?.videoWidth??0),h=typeof a[4]==='number'&&a.length>=9?a[4]:(a[5]?.height??a[5]?.videoHeight??0);add(x,w*h*4);}return r;};
  const rs=P.renderbufferStorage;P.renderbufferStorage=function(t,f,w,h){const r=rs.apply(this,arguments),x=binding(this,'r');if(x)add(x,w*h*(f===this.DEPTH_COMPONENT16?2:4));return r;};
  for(const [name,del] of [['deleteBuffer',P.deleteBuffer],['deleteTexture',P.deleteTexture],['deleteRenderbuffer',P.deleteRenderbuffer]])
    P[name]=function(o){drop(o);return del.apply(this,arguments);};
  const nativeRAF=window.requestAnimationFrame.bind(window);
  const timer={intervals:[],gpu:[],last:0,frame:-1,recording:false,pending:[],disjoint:0,drawFrames:0,id:0,queriesLost:0};
  window.__timing=timer;
  let gl=null,ext=null,draws=0,measuring=false;
  const get=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type){
    const result=get.apply(this,arguments);
    if(type==='webgl2'&&result&&!gl){gl=result;ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');}
    return result;
  };
  for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
    const draw=P[name];P[name]=function(){if(measuring&&this===gl)draws++;return draw.apply(this,arguments);};
  }
  function collect(){
    if(!ext||!gl||!timer.pending.length)return;
    if(gl.getParameter(ext.GPU_DISJOINT_EXT)){
      timer.disjoint++;
      for(const q of timer.pending)gl.deleteQuery(q);
      timer.pending.length=0;return;
    }
    while(timer.pending.length && gl.getQueryParameter(timer.pending[0],gl.QUERY_RESULT_AVAILABLE)){
      const q=timer.pending.shift();
      timer.gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);
    }
  }
  timer.begin=function(){
    if(timer.recording||timer.pending.length)throw Error('Previous GPU sample is still active');
    Object.assign(timer,{intervals:[],gpu:[],last:0,first:0,recording:true,disjoint:0,drawFrames:0,queriesLost:0});
    acct.peak=acct.live;
  };
  timer.finish=async function(){
    timer.recording=false;timer.move=null;
    const until=performance.now()+1600;
    while(timer.pending.length&&performance.now()<until){collect();if(timer.pending.length)await new Promise(resolve=>setTimeout(resolve,16));}
    timer.queriesLost=timer.pending.length;
    for(const q of timer.pending)gl.deleteQuery(q);
    timer.pending.length=0;
    return {intervals:timer.intervals,gpu:timer.gpu,drawFrames:timer.drawFrames,disjoint:timer.disjoint,queriesLost:timer.queriesLost,
      gpuAvailable:!!ext,durationMs:timer.last-timer.first,peak:acct.peak,live:acct.live,glError:gl?.getError(),contextLost:gl?.isContextLost()};
  };
  window.requestAnimationFrame=function(callback){return nativeRAF(function(t){
    if(timer.recording&&timer.frame!==t){
      timer.frame=t;if(!timer.first)timer.first=t;
      if(timer.last)timer.intervals.push(t-timer.last);timer.last=t;
      if(timer.move)timer.move(t-timer.first);
    }
    if(!timer.recording){callback(t);collect();return;}
    const before=draws,q=ext&&gl?gl.createQuery():null;
    if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);
    measuring=true;
    try{callback(t);}finally{
      measuring=false;
      if(draws>before)timer.drawFrames++;
      if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);if(draws>before)timer.pending.push(q);else gl.deleteQuery(q);}
      collect();
    }
  });};
}
module.exports={instrument};
