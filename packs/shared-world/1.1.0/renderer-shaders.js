import {TERRAIN_GLSL} from '../../infinite-meadow/1.0.0/landscape.js';
import {canopyShaders} from '../../infinite-meadow/1.0.0/grass-shaders.js';
import {GLSL_SHARED_GROUND} from './reference.js';

function once(source, before, after, label) {
  const at=source.indexOf(before);
  if(at<0||source.indexOf(before,at+before.length)>=0)throw Error(`Shared renderer shader contract changed: ${label}`);
  return source.slice(0,at)+after+source.slice(at+before.length);
}

// The original numeric Meadow function stays intact. Only its final geographic
// assignment is composed with the shared reference used by walking support.
export const SHARED_GROUND_GLSL=once(TERRAIN_GLSL,'float coverGround(vec2 at)','float meadowGround(vec2 at)','ground function')+
  '\n'+GLSL_SHARED_GROUND+'\nfloat coverGround(vec2 at){return sharedGroundHeight(at,meadowGround(at));}\n';

export function sharedCanopyShaders() {
  const shaders=canopyShaders(SHARED_GROUND_GLSL);
  const refusal='if(alpha<.001)';
  shaders.nearVS=once(shaders.nearVS,refusal,'alpha*=sharedMeadowCoverage(at);\n '+refusal,'near geographic assignment');
  shaders.boxVS=once(shaders.boxVS,refusal,'float sharedCoverage=sharedMeadowCoverage(at);alpha*=sharedCoverage;fadeWindow*=sharedCoverage;\n '+refusal,'clump geographic assignment');
  return shaders;
}

export function sharedTerrainShaders(vertexSource,fragmentSource) {
  const vertex=once(vertexSource,TERRAIN_GLSL,SHARED_GROUND_GLSL,'terrain ground source');
  let fragment=once(fragmentSource,'void main(){',GLSL_SHARED_GROUND+'\nvoid main(){','terrain fragment entry');
  fragment=once(fragment,'(1.-smoothstep(6000.,22000.,distanceM))*.92',
    '(1.-smoothstep(6000.,22000.,distanceM))*.92*sharedMeadowCoverage(position.xz)','terrain canopy assignment');
  // The apron shares the same material assignment as its support, while every
  // original Meadow material expression is retained outside the apron.
  fragment=once(fragment,'col*=.91+.18*mix(.5,texture,detailWeight);',
    'col=mix(col,vec3(.25,.27,.24)*lit,sharedIndustryBlend(position.xz));\n   col*=.91+.18*mix(.5,texture,detailWeight);','apron material');
  return {vertex,fragment};
}

export function programSources(gl,program) {
  const result={};
  for(const shader of gl.getAttachedShaders(program)??[]) {
    const type=gl.getShaderParameter(shader,gl.SHADER_TYPE);
    result[type===gl.VERTEX_SHADER?'vertex':'fragment']=gl.getShaderSource(shader);
  }
  if(typeof result.vertex!=='string'||typeof result.fragment!=='string')throw Error('Original Meadow shader source unavailable');
  return result;
}

export function compileSharedProgram(gl,vertex,fragment) {
  const shaders=[];let program=null;
  try {
    for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]) {
      const shader=gl.createShader(type);if(!shader)throw Error('Shared renderer shader allocation failed');
      shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader)||'Shared renderer shader compile failed');
    }
    program=gl.createProgram();if(!program)throw Error('Shared renderer program allocation failed');
    for(const shader of shaders)gl.attachShader(program,shader);
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'Shared renderer program link failed');
    return program;
  } catch(error) {
    if(program)gl.deleteProgram(program);
    throw error;
  } finally {
    for(const shader of shaders)gl.deleteShader(shader);
  }
}
