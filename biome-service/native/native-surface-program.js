/* Fixed trusted native surface program source. Pure string assembly only;
 * no renderer, framebuffer, camera, worker, readiness or provider code owner. */
(function(root){'use strict';
const node=typeof module!=='undefined',R=root.SphereBiomeRecords||(node?require('../records.js'):null),Boundary=root.SphereBiomeNativeBoundaryShader||(node?require('./boundary-shader.js'):null),O=root.SphereBiomeOverviewShader||(node?require('./overview-shader.js'):null);
function fail(code,message,details={}){throw R.error(code,message,details,'native-surface-program');}
const VERTEX=String.raw`#version 300 es
precision highp float;precision highp int;
layout(location=0) in vec3 aPosition;
uniform mat4 uViewProjection;uniform vec3 uBpsRebaseHigh,uBpsRebaseLow;uniform highp uint uBpsVertexRoundXor;
out vec3 vEyePosition;out vec3 vPreparedPosition;out vec4 vBpsProjectedPosition;
float bpsVertexRound(float v){return uintBitsToFloat(floatBitsToUint(v)^uBpsVertexRoundXor);}
vec3 bpsVertexRound3(vec3 v){return vec3(bpsVertexRound(v.x),bpsVertexRound(v.y),bpsVertexRound(v.z));}
void main(){vPreparedPosition=aPosition;vEyePosition=bpsVertexRound3(bpsVertexRound3(aPosition+uBpsRebaseHigh)+uBpsRebaseLow);vBpsProjectedPosition=uViewProjection*vec4(vEyePosition,1.);gl_Position=vBpsProjectedPosition;}`;
function surfaceFragment(source){
 if(typeof source!=='string'||source.split('void main(){').length!==2||!O||!Boundary?.GLSL)fail('SHADER_SOURCE_MISMATCH','The complete admitted host material and fixed native boundary source are required');
 const at=source.indexOf('void main(){');let prefix=source.slice(0,at).replace('in vec2 vUV;','');
 if(prefix.includes('in vec2 vUV;'))fail('SHADER_SOURCE_MISMATCH','The root material varying changed');
 // The root overview kernel supplies only fixed DS arithmetic here; no provider
 // shader or texture selector can enter this assembly. Unused ownership lookup
 // functions are not the native surface's geography or generator.
 const arithmetic=root.SphereBiomeOverviewIndex?.kernel;if(typeof arithmetic!=='string')fail('SHADER_SOURCE_MISMATCH','The fixed root DS arithmetic source is unavailable');
 return prefix+'\n'+arithmetic+'\n'+Boundary.GLSL+String.raw`
in vec3 vEyePosition;in vec3 vPreparedPosition;
uniform vec4 uColor;uniform int uBpsSurfaceCoverage;uniform int uBpsSurfaceBoundary;
void main(){
 if(uBpsSurfaceCoverage!=1)discard;
 vec3 relativeKm=vEyePosition*.001;
 gl_FragDepth=clamp(log2(1.+length(relativeKm))/log2(1.+4.*uRadius),0.,1.);
 vec3 q=normalize(camera()+relativeKm/uRadius),delta=relativeKm-uN*(uH*uRadius);
 float footprint=max(length(dFdx(delta)),length(dFdy(delta)));
 float weight=uBpsSurfaceBoundary==1?bpsNativeBoundaryWeight(bpsNativeFragmentChart(vPreparedPosition)):1.;
 vec3 normal=normalize(cross(dFdx(vEyePosition),dFdy(vEyePosition)));if(dot(normal,vEyePosition)>0.)normal=-normal;
 vec3 base=surfaceMaterial(q,delta,footprint,length(relativeKm));
 vec3 material=mix(base,uColor.rgb,weight);
 float fill=uShineField==1?dot(q*q,uCavity):uShine;
 float visibility=uCollection==1?collectionLight(q):lightFraction(q);
 float cosine=max(0.,dot(normal,-q));float shadow=structureShadow(delta,normal);
 vec3 radiance=max(material*(fill+cosine*visibility*uLuminosity*shadow),vec3(0.));
 fragColor=vec4(uLinearOutput==1?radiance:pow(vec3(1.)-exp(-radiance*uExposure),vec3(1./2.2)),1.);
}
`;
}
const api=Object.freeze({VERTEX,surfaceFragment});root.SphereBiomeNativeSurfaceProgram=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
