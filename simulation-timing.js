/* Wall-clock movement with bounded work and no accumulated input debt. */
(function(root){
'use strict';const STEP=1/60,BUDGET=.25;let dropped=0,frames=[];
function advance(s,elapsed,move){
 elapsed=Math.max(0,Number.isFinite(elapsed)?elapsed:0);let remaining=Math.min(elapsed,BUDGET),steps=0;
 while(remaining>1e-10){const dt=Math.min(STEP,remaining);if(s.playing)root.SphereInspection.setTime(s,root.SphereMath.clamp(s.time+dt*s.timeRate,-1e9,1e9));move(dt);remaining-=dt;steps++;}
 const excess=Math.max(0,elapsed-BUDGET);dropped+=excess;
 if(excess&&s.playing)root.SphereInspection.setTime(s,root.SphereMath.clamp(s.time+excess*s.timeRate,-1e9,1e9));
 frames.push(elapsed*1000);if(frames.length>600)frames.shift();return {steps,droppedSeconds:excess};
}
function previewStamp(previous,now,fps){
 const period=1000/fps;
 // Keep fractional cadence on fast displays, but never date a completed
 // draw in the future. Early-frame tolerance otherwise accumulates a phase
 // error which intermittently skips 60 Hz frames despite spare GPU time.
 return Number.isFinite(previous)?Math.min(now,previous+Math.max(1,Math.floor((now-previous+.8)/period))*period):now;
}
root.SphereTiming={advance,previewStamp,stepSeconds:STEP,budgetSeconds:BUDGET,get diagnostics(){const sorted=frames.slice().sort((a,b)=>a-b);return {frames:frames.length,medianMs:sorted[Math.floor(sorted.length*.5)]||0,p95Ms:sorted[Math.floor(sorted.length*.95)]||0,maxMs:sorted.at(-1)||0,droppedMovementSeconds:dropped};}};
})(typeof window==='undefined'?globalThis:window);
