/* Main-owned triangle-local varyings and CPU-projected clip coordinates.
 * This source alone supplies no fragment/whole-view admission. */
(function(root){'use strict';
const node=typeof module!=='undefined',Base=root.SphereBiomeNativeSurfaceProgram||(node?require('./native-surface-program.js'):null);
const VERTEX=`#version 300 es
precision highp float;precision highp int;
layout(location=0) in vec4 aClip;
layout(location=1) in vec3 aOrigin;
layout(location=2) in vec3 aOffset;
layout(location=3) in float aTriangle;
out vec4 vBpsClip;flat out highp vec3 vBpsOrigin;out highp vec3 vBpsOffset;flat out highp float vBpsTriangle;
invariant gl_Position;invariant vBpsClip;invariant vBpsOrigin;invariant vBpsOffset;invariant vBpsTriangle;
void main(){gl_Position=aClip;vBpsClip=aClip;vBpsOrigin=aOrigin;vBpsOffset=aOffset;vBpsTriangle=aTriangle;}`;
function surfaceFragment(host){
 let source=Base.surfaceFragment(host),declaration='in vec3 vEyePosition;in vec3 vPreparedPosition;',entry='void main(){\n if(uBpsSurfaceCoverage!=1)discard;';
 if(source.split(declaration).length!==2||source.split(entry).length!==2)throw Error('Fixed native surface source changed');
 if(source.split('layout(location=1)out vec4 silhouetteMask;').length!==2)throw Error('Main silhouette declaration changed');
 source=source.replace('layout(location=1)out vec4 silhouetteMask;','vec4 silhouetteMask;');
 if(source.split('out vec4 fragColor;').length!==2)throw Error('Fixed material output changed');
 source=source.replace('out vec4 fragColor;',`out vec4 fragColor;
layout(location=1) out vec4 bpsFieldY;layout(location=2) out vec4 bpsFieldZ;layout(location=3) out vec4 bpsFieldTriangle;`);
 source=source.replace(declaration,`flat in highp vec3 vBpsOrigin;in highp vec3 vBpsOffset;flat in highp float vBpsTriangle;
uniform int uBpsStreamWitnessAxis;
vec4 bpsStreamBits(float value){uint b=floatBitsToUint(value);return vec4(float(b&255u),float((b>>8u)&255u),float((b>>16u)&255u),float((b>>24u)&255u))/255.;}`);
 source=source.replace(entry,`void main(){
 if(uBpsSurfaceCoverage!=1)discard;
 vec3 vEyePosition=vec3(bpsRound(vBpsOrigin.x+vBpsOffset.x),bpsRound(vBpsOrigin.y+vBpsOffset.y),bpsRound(vBpsOrigin.z+vBpsOffset.z));
 vec3 vPreparedPosition=vEyePosition;
 if(uBpsStreamWitnessAxis>0){
  vec3 witnessKm=vEyePosition*.001;
  gl_FragDepth=clamp(log2(1.+length(witnessKm))/log2(1.+4.*uRadius),0.,1.);
  fragColor=bpsStreamBits(vEyePosition.x);bpsFieldY=bpsStreamBits(vEyePosition.y);bpsFieldZ=bpsStreamBits(vEyePosition.z);bpsFieldTriangle=bpsStreamBits(vBpsTriangle);return;}`);
 const radiance=' fragColor=vec4(uLinearOutput==1?radiance:pow(vec3(1.)-exp(-radiance*uExposure),vec3(1./2.2)),1.);';
 if(source.split(radiance).length!==2)throw Error('Fixed material radiance output changed');
 source=source.replace(radiance,' if(any(isnan(radiance))||any(isinf(radiance))||any(greaterThan(abs(radiance),vec3(65504.)))){fragColor=vec4(0.);return;}\n'+radiance);
 return source;
}
const api=Object.freeze({VERTEX,surfaceFragment,STRIDE_WORDS:11,STRIDE_BYTES:44,VARYINGS:Object.freeze(['vBpsClip','vBpsOrigin','vBpsOffset','vBpsTriangle'])});root.SphereBiomeLocalStreamProgramV2=api;if(node)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
