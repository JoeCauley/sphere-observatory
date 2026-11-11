/* Main-owned triangle-local varyings and CPU-projected clip coordinates.
 * This source alone supplies no fragment/whole-view admission. */
(function(root){'use strict';
const node=typeof module!=='undefined',Base=root.SphereBiomeNativeSurfaceProgram||(node?require('./native-surface-program.js'):null);
const VERTEX=`#version 300 es
precision highp float;precision highp int;
layout(location=0) in vec4 aClip;
layout(location=1) in vec3 aOrigin;
layout(location=2) in vec3 aOffset;
out vec4 vBpsClip;flat out highp vec3 vBpsOrigin;out highp vec3 vBpsOffset;
invariant gl_Position;invariant vBpsClip;invariant vBpsOrigin;invariant vBpsOffset;
void main(){gl_Position=aClip;vBpsClip=aClip;vBpsOrigin=aOrigin;vBpsOffset=aOffset;}`;
function surfaceFragment(host){
 let source=Base.surfaceFragment(host),declaration='in vec3 vEyePosition;in vec3 vPreparedPosition;',entry='void main(){\n if(uBpsSurfaceCoverage!=1)discard;';
 if(source.split(declaration).length!==2||source.split(entry).length!==2)throw Error('Fixed native surface source changed');
 source=source.replace(declaration,`flat in highp vec3 vBpsOrigin;in highp vec3 vBpsOffset;
uniform int uBpsStreamWitnessAxis;
vec4 bpsStreamBits(float value){uint b=floatBitsToUint(value);return vec4(float(b&255u),float((b>>8u)&255u),float((b>>16u)&255u),float((b>>24u)&255u))/255.;}`);
 source=source.replace(entry,`void main(){
 if(uBpsSurfaceCoverage!=1)discard;
 vec3 vEyePosition=vec3(bpsRound(vBpsOrigin.x+vBpsOffset.x),bpsRound(vBpsOrigin.y+vBpsOffset.y),bpsRound(vBpsOrigin.z+vBpsOffset.z));
 vec3 vPreparedPosition=vEyePosition;
 if(uBpsStreamWitnessAxis>0){fragColor=bpsStreamBits(vEyePosition[clamp(uBpsStreamWitnessAxis-1,0,2)]);return;}`);
 return source;
}
const api=Object.freeze({VERTEX,surfaceFragment,STRIDE_WORDS:10,STRIDE_BYTES:40});root.SphereBiomeLocalStreamProgram=api;if(node)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
