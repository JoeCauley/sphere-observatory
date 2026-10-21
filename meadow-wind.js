/* IB-075-G: explicit wind timeline v1. Unversioned scenes keep their clocks.
 * Phase is seconds; geographic field coordinates are metres; bend is a
 * fraction of stem height. No placement or residency depends on this module. */
(function(root){
'use strict';
const REVISION=1,DEFAULT_STRENGTH=.38,MAX_STRENGTH=.38;
const GLSL=`
vec2 meadowWind(vec2 metres,float phase){float a=dot(metres,vec2(.073,.041))-phase*.31,b=dot(metres,vec2(-.029,.055))-phase*.19;float gust=.66+.22*sin(a)+.12*sin(b);return vec2(.82,.57)*gust+vec2(.07*sin(b),.05*cos(a));}
`;
const active=s=>s?.meadow?.representationRevision===3&&s.meadow.windTimelineRevision===REVISION;
function mapped(s,time=s.time){const m=s.meadow;return m.windPhaseSeconds+(time-m.windAnchorSceneTime)/m.windSceneSecondsPerSecond;}
function phase(s){return s.playing===false?s.meadow.windResolvedPhaseSeconds:mapped(s);}
function anchor(s,value,rate=s.timeRate){
 if(!active(s))return s;
 const m=s.meadow;
 m.windPhaseSeconds=value;m.windResolvedPhaseSeconds=value;m.windAnchorSceneTime=s.time;
 m.windSceneSecondsPerSecond=rate/m.windVisualSpeed;
 m.wind={phaseSeconds:value,anchorSceneTime:s.time,sceneSecondsPerWindSecond:m.windSceneSecondsPerSecond};
 return s;
}
function playback(s,playing,displayedPhase){
 if(active(s)&&!!playing!==!!s.playing)anchor(s,Number.isFinite(displayedPhase)?displayedPhase:phase(s));
 s.playing=!!playing;return s;
}
function rate(s,value){if(active(s))anchor(s,phase(s),value);s.timeRate=value;return s;}
function scrub(s){if(active(s))s.meadow.windResolvedPhaseSeconds=mapped(s);return s;}
// Preserve the recorded affine mapping, including its original anchors.
function snapshot(s,displayedPhase){const copy=structuredClone(s);if(active(s)){copy.meadow.windResolvedPhaseSeconds=Number.isFinite(displayedPhase)?displayedPhase:phase(s);copy.playing=false;}return copy;}
function validate(m,time,timeRate){
 if(!('windTimelineRevision' in m))return {};
 if(m.windTimelineRevision!==REVISION)throw Error('Unsupported meadow wind timeline revision');
 const finite=(v,name)=>{if(!Number.isFinite(v))throw Error('Invalid meadow wind '+name);return v;};
 if(m.appearanceRevision!==4)throw Error('Wind timeline v1 requires the F2 canopy');
 const speed=finite(m.windVisualSpeed??1,'visual speed'),strength=finite(m.windStrength??DEFAULT_STRENGTH,'strength');
 if(speed<=0||speed>4||strength<0||strength>MAX_STRENGTH)throw Error('Invalid meadow wind speed or strength');
 for(const key of ['windPhaseSeconds','windAnchorSceneTime','windSceneSecondsPerSecond'])finite(m[key],key);
 if(m.windSceneSecondsPerSecond<=0)throw Error('Invalid meadow wind divisor');
 const resolved=finite(m.windResolvedPhaseSeconds??(m.windPhaseSeconds+(time-m.windAnchorSceneTime)/m.windSceneSecondsPerSecond),'resolved phase');
 return {windTimelineRevision:REVISION,windVisualSpeed:speed,windResolvedPhaseSeconds:resolved,windStrength:strength};
}
function field(metres,phaseSeconds){
 const [x,z]=metres,a=x*.073+z*.041-phaseSeconds*.31,b=x*-.029+z*.055-phaseSeconds*.19,gust=.66+.22*Math.sin(a)+.12*Math.sin(b);
 return {direction:[.82,0,.57],gust,vector:[.82*gust+.07*Math.sin(b),.57*gust+.05*Math.cos(a)]};
}
const api={REVISION,DEFAULT_STRENGTH,MAX_STRENGTH,GLSL,active,mapped,phase,anchor,playback,rate,scrub,snapshot,validate,field};
root.SphereMeadowWind=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
