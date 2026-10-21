import {Renderer} from '../../infinite-meadow/1.0.0/renderer.js';
import {renderOrigin} from '../../infinite-meadow/1.0.0/coordinates.js';
import {EYE} from '../../infinite-meadow/1.0.0/model.js';
import {IndustryDisplay} from './industry-display.js';
import {programSources,sharedTerrainShaders,sharedCanopyShaders,compileSharedProgram} from './renderer-shaders.js';

export class SharedWorldRenderer extends Renderer {
  constructor(canvas,reference,preparation,lease,options={}) {
    super(canvas);
    this.reference=reference;this.facility=reference.facility;this.preparation=preparation;this.lease=lease;
    this.industryDisplay=null;this.closed=false;
    this.meadowGpuBytes=this.gpuBytes;
    const replacements=[];
    try {
      const terrain=sharedTerrainShaders(...(()=>{const s=programSources(this.gl,this.terrainProgram);return [s.vertex,s.fragment];})());
      const grass=sharedCanopyShaders();
      for(const [key,vertex,fragment] of [['terrainProgram',terrain.vertex,terrain.fragment],['grass',grass.nearVS,grass.nearFS],['grassbox',grass.boxVS,grass.boxFS]])
        replacements.push({key,program:compileSharedProgram(this.gl,vertex,fragment)});
      for(const {key,program} of replacements){this.gl.deleteProgram(this[key]);this[key]=program;}
      replacements.length=0;this.uniforms.clear();
      this.industryDisplay=new IndustryDisplay(this.gl,this.facility,preparation,options);
      this.info.industryStartupPreparationMs=this.industryDisplay.startupPreparationMs;
      this.updateOwnedBytes();
      this.info.content='Infinite Meadow + Infinite Industry · one geographic world, camera, sky, clock and Meadow WebGL2 context';
      this.info.coverage+='; full original 150 m Industry facility, six original fallback zones and original detailed-zone residency';
      this.info.assignment={industryCenter:[...this.facility.center],flatRadiusM:reference.flatRadiusM??120,apronM:reference.apronM??128};
    } catch(error) {
      for(const {program} of replacements)this.gl.deleteProgram(program);
      this.dispose();throw error;
    }
  }
  common(program,pose) {
    super.common(program,pose);
    if(this.facility)this.uniform(program,'uIndustryRelative',2,[this.facility.center[0]-pose.eastM,this.facility.center[1]-pose.northM]);
  }
  coverUniforms(program,state) {
    super.coverUniforms(program,state);
    this.uniform(program,'uClearance',1,state.pose.altitudeM-this.reference.groundHeight(state.pose.eastM,state.pose.northM)-EYE);
  }
  resize(width,height) {
    if(this.closed)return;
    if(Number.isFinite(width)&&width>0)this.canvas.width=Math.floor(width);
    if(Number.isFinite(height)&&height>0)this.canvas.height=Math.floor(height);
  }
  updateOwnedBytes() {
    let bytes=this.meadowGpuBytes;
    bytes+=this.industryDisplay?.bytes??0;this.gpuBytes=bytes;this.info.ownedGpuBufferBytes=bytes;
    return bytes;
  }
  drawShared(state,meadowResidency,sharedFrame={}) {
    if(this.closed)throw Error('Shared renderer disposed');
    const started=performance.now(),gl=this.gl,p=state.pose,origin=sharedFrame.origin??renderOrigin(p);
    let query=null;
    // The combined timing query includes every Meadow and Industry submission.
    if(this.ext&&this.queries.length<8){query=gl.createQuery();gl.beginQuery(this.ext.TIME_ELAPSED_EXT,query);}
    try {
      const meadow=super.draw(state,meadowResidency,{timing:false});
      this.common(this.mesh,p);
      for(const [key,value] of [['uNormalized',0],['uDaylight',meadow.interiorDaylight],['uReveal',meadow.reveal],['uGround',0],['uAlpha',1],['uScale',1],['uOffsetY',0]])this.uniform(this.mesh,key,1,value);
      this.uniform(this.mesh,'uCamera',3,[p.eastM-origin.eastM,p.altitudeM,p.northM-origin.northM]);
      gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.depthMask(true);
      const industry=this.industryDisplay.draw(state,{width:this.canvas.width,height:this.canvas.height,origin});
      this.updateOwnedBytes();
      return {...meadow,renderCpuMs:performance.now()-started,drawCalls:meadow.drawCalls+industry.drawCalls,triangles:meadow.triangles+industry.staticTriangles+industry.motionTriangles,
        uploadBytes:meadow.uploadBytes+industry.uploadBytes,uploadCpuMs:industry.uploadCpuMs,motionPreparationMs:industry.motionPreparationMs,industryPreparationMs:industry.displayPreparationMs,gpuBytes:this.gpuBytes,
        gpuQueryPending:this.queries.length+(query?1:0),origin,
        industry:{...industry,totals:{...this.industryDisplay.totals}},
        sharedWorld:true};
    } finally {
      if(query){gl.endQuery(this.ext.TIME_ELAPSED_EXT);this.queries.push({query,frame:this.frame});}
    }
  }
  dispose() {
    if(this.closed)return;this.closed=true;const gl=this.gl;
    this.industryDisplay?.dispose();
    for(const key of ['terrainMesh','landmarkMesh','latticeMesh','beltMesh']){const mesh=this[key];if(mesh?.buffer)gl.deleteBuffer(mesh.buffer);if(mesh?.vao)gl.deleteVertexArray(mesh.vao);}
    for(const key of ['bladeBuffer','outerBuffer'])if(this[key])gl.deleteBuffer(this[key]);
    for(const key of ['grassVAO','outerVAO'])if(this[key])gl.deleteVertexArray(this[key]);
    for(const key of ['screen','mesh','grass','grassbox','terrainProgram'])if(this[key])gl.deleteProgram(this[key]);
    for(const {query} of this.queries)gl.deleteQuery(query);this.queries.length=0;this.uniforms.clear();this.gpuBytes=0;
    this.info.ownedGpuBufferBytes=0;
  }
}
