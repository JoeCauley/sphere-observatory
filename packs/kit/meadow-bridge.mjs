import {cameraBasis,poseFrame,hash32} from '../infinite-meadow/1.3.0/coordinates.js';
import {initialState,sceneLight,GROUND_DATUM} from '../infinite-meadow/1.3.0/model.js';
import {terrainPhases,landscapePhases,terrain} from '../infinite-meadow/1.3.0/landscape.js';
import {meadowShaders,meadowSkyFragment,bindMeadowBackdrop,compile,createBladeGeometry} from '../infinite-meadow/1.3.0/renderer.js';
import {canopyShaders} from '../infinite-meadow/1.3.0/grass-shaders.js';
import {createVergeView} from '../infinite-meadow/1.3.0/verge-view.js';
import {heroAllocation} from '../infinite-meadow/1.3.0/grass-allocation.js';
import {profileFor,STAGE,windUniforms,transitionPhases,canopyAtlasFootprint} from '../infinite-meadow/1.3.0/grass-stage.js';
import {lineageAnchor} from '../infinite-meadow/1.3.0/grass-handoff.js';
import {surfaceAnchor} from '../infinite-meadow/1.3.0/meadow-surface.js';
import {terrainGridOffsets,TERRAIN_GRID} from '../infinite-meadow/1.3.0/terrain-grid.js';

const groundBlock=6, grassBlock=8, maxBlocks=TERRAIN_GRID.levels*(TERRAIN_GRID.cells/groundBlock)**2;
const groundVS=meadowShaders.terrainVS.replace('layout(location=0)in vec3 aPos;', `
layout(location=0)in vec3 block;
const vec2 corners[6]=vec2[6](vec2(0,0),vec2(0,1),vec2(1,1),vec2(0,0),vec2(1,1),vec2(1,0));
vec3 gridVertex(){
  int cell=gl_VertexID/6;
  vec2 p=(block.xy+vec2(cell%${groundBlock},cell/${groundBlock})+corners[gl_VertexID%6])*(2.*exp2(block.z));
  return vec3(p.x,block.z,p.y);
}`).replace('int level=int(aPos.y);','vec3 aPos=gridVertex();int level=int(aPos.y);');
const procedural=canopyShaders();
const clumpVS=procedural.boxVS.replace('void main(){',`
layout(location=0)in vec3 block;
uniform int verticesPerCell;
void main(){`).replace('uvec2 local=uvec2(uint(gl_InstanceID)%128u,uint(gl_InstanceID)/128u)',
  `int index=gl_VertexID/verticesPerCell;
  uvec2 local=uvec2(block.xy)+uvec2(index%${grassBlock},index/${grassBlock})`).replace('uint(gl_VertexID/3)','uint((gl_VertexID%verticesPerCell)/3)');

// Crop after projecting through the actual camera lens. Invalid vertices from
// the native grass shaders must remain clipped even for an off-axis capture.
function cropGeometry(source,clipped){
  const boundary=clipped?'uniform vec4 portalPlane;out float portalDistance;':'';
  return source.replace('void main(){',boundary+'uniform vec4 portalCrop;\nvoid nativeMain(){')+`
void main(){nativeMain();
 ${clipped?'portalDistance=dot(portalPlane,vec4(gl_Position.xyw,1.));':''}
 gl_Position.xy=(gl_Position.xy-gl_Position.w*portalCrop.xy)/portalCrop.zw;}`;
}
function clipAtDoor(source,clipped){
  return clipped?source.replace('void main(){','in float portalDistance;\nvoid main(){if(portalDistance<0.)discard;'):source;
}
// Native coverage dither is indexed in presentation pixels. Give a cropped
// target the same coordinates or a strafe can make stationary leaves sparkle.
function cropCoverage(source){
  return source.replace('float screenNoise(){','uniform vec4 portalPixels;\nfloat screenNoise(){')
    .replaceAll('gl_FragCoord.xy','(portalPixels.xy+gl_FragCoord.xy*portalPixels.zw)');
}
const skyVS=meadowShaders.skyVS.replace('void main(){','uniform vec4 portalCrop;\nvoid main(){')
  .replace('gl_Position=vec4(screen,1.,1.);','gl_Position=vec4(screen,1.,1.);screen=portalCrop.xy+screen*portalCrop.zw;');
// The native landscape intentionally cuts holes for the station's roads.
// Inside a portal even these holes have a sky backdrop. Mark the paved rays
// in its alpha channel so the photograph reveals the host's actual pavement.
// Closer Meadow soil and vegetation subsequently cover the mask as usual.
function bridgeSkyFragment(recipe,clipped){
  const native=meadowSkyFragment(recipe);
  if(!clipped)return native;
  return native.replace('void main(){','void meadowSky(){')+`
uniform mat3 roadRays;
uniform vec3 roadEye;
uniform vec4 roadCenters,roadHalfWidths;
uniform vec3 roadSurface;
void main(){
 meadowSky();
 vec3 ray=roadRays*vec3(screen,1.);
 if(ray.y>=0.)return;
 float t=(roadSurface.z-roadEye.y)/ray.y;
 vec2 ground=roadEye.xz+ray.xz*t;
 if(t<=0. || ground.y<roadSurface.x || ground.y>roadSurface.y)return;
 // The heavy-haul cut has its own terrain. Only the other three routes
 // have the horizontal wearing course modelled by the station.
 if(any(lessThanEqual(abs(ground.xxx-roadCenters.xyw),roadHalfWidths.xyw)))frag.a=0.;
}`;
}

function frustum(axes,crop,fx,fy){
  const [cx,cy,hx,hy]=crop;
  const plane=(axis,f,k)=>axis.map((v,i)=>v*f+k*axes.forward[i]);
  return [axes.forward,plane(axes.right,fx,hx-cx),plane(axes.right,-fx,hx+cx),
    plane(axes.up,fy,hy-cy),plane(axes.up,-fy,hy+cy)];
}

export function createMeadowBridge(gl,{clipAtAperture=false}={}){
  const programs=[],locations=new Map(),base=initialState();
  const vergeView=createVergeView(gl,compile);
  const blocks=new Float32Array(maxBlocks*3),gridOffsets=new Float32Array(24);
  let offsets=null,seeds=null;
  let blockBuffer=null,blockVao=null,sky=null,ground=null,grass=null,clumps=null,blades=null,disposed=false;
  let skyRecipe='',textureBytes=0;const textures={};
  let tileKey='',tiles=[],descriptorsBuilt=0;
  let draws=0,terrainBlocks=0,clumpBlocks=0,grassTiles=0,submittedTufts=0;
  function program(vs,fs){
    const p=compile(gl,vs,fs);programs.push(p);locations.set(p,new Map());return p;
  }
  function uniform(p,k,type,...data){
    const map=locations.get(p);
    if(!map.has(k))map.set(k,gl.getUniformLocation(p,k));
    const loc=map.get(k);if(loc!==null)gl[type](loc,...data);
  }
  function vegetationPrograms(){
    if(blades)return;
    grass=program(cropGeometry(procedural.nearVS,clipAtAperture),clipAtDoor(cropCoverage(procedural.nearFS),clipAtAperture));
    blades=createBladeGeometry(gl);
  }
  function dropProgram(p){
    if(!p)return;
    gl.deleteProgram(p);locations.delete(p);
    programs.splice(programs.indexOf(p),1);
  }
  function releaseNear(){
    dropProgram(grass);grass=null;
    if(blades){
      gl.deleteVertexArray(blades.grassVAO);gl.deleteVertexArray(blades.outerVAO);
      gl.deleteBuffer(blades.bladeBuffer);gl.deleteBuffer(blades.outerBuffer);
    }
    blades=null;tiles.length=0;tileKey='';offsets=seeds=null;
    grassTiles=submittedTufts=0;
  }
  function releaseBackdrop(){
    for(const key of Object.keys(textures)){gl.deleteTexture(textures[key].texture);delete textures[key];}
    textureBytes=0;
  }
  function resetResources(){
    if(disposed)return;
    releaseNear();releaseBackdrop();vergeView.dispose();
    for(const p of programs)gl.deleteProgram(p);
    programs.length=0;locations.clear();
    if(blockVao)gl.deleteVertexArray(blockVao);
    if(blockBuffer)gl.deleteBuffer(blockBuffer);
    blockBuffer=blockVao=clumps=null;disposed=true;
    draws=terrainBlocks=clumpBlocks=0;
  }
  try{
    sky=program(skyVS,bridgeSkyFragment('',clipAtAperture));ground=program(cropGeometry(groundVS,clipAtAperture),clipAtDoor(meadowShaders.groundFS,clipAtAperture));
    blockBuffer=gl.createBuffer();blockVao=gl.createVertexArray();
    gl.bindVertexArray(blockVao);gl.bindBuffer(gl.ARRAY_BUFFER,blockBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,blocks.byteLength,gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);gl.vertexAttribDivisor(0,1);
    gl.bindVertexArray(null);
  }catch(error){resetResources();throw error;}
  function uploadBlocks(count){
    gl.bindVertexArray(blockVao);gl.bindBuffer(gl.ARRAY_BUFFER,blockBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,blocks,0,count*3);
  }
  function inspect(){return {programs:programs.length,textureBytes,bufferBytes:(blockBuffer?blocks.byteLength:0)+(blades?.bytes??0),
    descriptorBytes:disposed?0:blocks.byteLength+(offsets?.byteLength??0)+(seeds?.byteLength??0)+gridOffsets.byteLength,
    tileDescriptors:tiles.length,descriptorBuilds:descriptorsBuilt,draws,terrainBlocks,clumpBlocks,grassTiles,submittedTufts};}
  function draw(args){
    if(disposed)throw Error('Released Meadow bridge');
    const scene=args.scene??args,pose=scene.pose,apron=scene.apron,station=scene.station;
    if(!pose||!station||!apron)throw Error('Meadow bridge requires surveyed station, apron and chart pose');
    const state={...base,...scene.settings,pose,windTime:scene.windTime??args.time??0};
    const direct=args.direct??scene.direct??1,light=sceneLight(state,direct),basis=scene.basis??cameraBasis(pose);
    const aspect=args.aspect??args.camera.focal[1]/args.camera.focal[0];
    const fy=args.camera?.focal[1]??aspect/Math.tan(args.horizontalFov*Math.PI/360),fx=fy/aspect;
    const crop=args.crop??[(args.ndc[0]+args.ndc[2])/2,(args.ndc[1]+args.ndc[3])/2,(args.ndc[2]-args.ndc[0])/2,(args.ndc[3]-args.ndc[1])/2];
    const screenWidth=args.camera?.width??args.width/crop[2],screenHeight=args.camera?.height??args.height/crop[3];
    const pixelMap=[(1+crop[0]-crop[2])*screenWidth/2,(1+crop[1]-crop[3])*screenHeight/2,
      screenWidth*crop[2]/args.width,screenHeight*crop[3]/args.height];
    const planes=frustum(basis,crop,fx,fy),profile=profileFor(state.grassDensity,state.grassHeightScale,state.grassWidthScale);
    const wind=windUniforms(state),surface=surfaceAnchor(pose.eastM,pose.northM),row=apron.row,axes=row.axes;
    const side=clipAtAperture?args.aperture.side:0;
    const eyeToDoor=clipAtAperture?args.camera.eye[2]-args.aperture.z:0;
    const roots=station.routes.map(r=>r.nearDoor[0]),lanes=station.routes.map(r=>r.door[0]/2+5);
    const ix=Math.abs(apron.x)-row.halfX,iz=Math.abs(apron.z)-row.halfZ;
    const apronBlend=Math.max(0,Math.min(1,Math.max(ix,iz)/96));
    const eyeGround=GROUND_DATUM+(terrain(pose.eastM,pose.northM)-GROUND_DATUM)*apronBlend*apronBlend*(3-2*apronBlend);
    const clearance=pose.altitudeM-eyeGround-1.7;
    terrainGridOffsets(pose.eastM,pose.northM,gridOffsets);
    draws=terrainBlocks=clumpBlocks=grassTiles=submittedTufts=0;
    function visible(x,z,half,height=48){
      // At the opposite entrance, a whole camera-centred grass grid may be
      // tens of kilometres on this side of the destination's jamb.
      if(side && side*(eyeToDoor+axes[2]*x+axes[3]*z)+half*(Math.abs(axes[2])+Math.abs(axes[3]))<0)return false;
      const y=height*.5-pose.altitudeM;
      return planes.every(n=>n[0]*x+n[1]*y+n[2]*z+half*(Math.abs(n[0])+Math.abs(n[2]))+height*.5*Math.abs(n[1])>=0);
    }
    function planted(x,z,half){
      const a=apron.x+axes[0]*x+axes[1]*z,b=apron.z+axes[2]*x+axes[3]*z;
      const dx=(Math.abs(axes[0])+Math.abs(axes[1]))*half,dz=(Math.abs(axes[2])+Math.abs(axes[3]))*half;
      if(Math.abs(a)+dx<row.halfX&&Math.abs(b)+dz<row.halfZ-3500)return false;
      if(Math.abs(a)+dx<row.halfX&&Math.abs(b)+dz<row.halfZ&&roots.some((center,i)=>Math.abs(a-center)+dx<lanes[i]))return false;
      return true;
    }
    // Each block contains the same cells as the native renderer. These tests
    // discard whole blocks only when no part can reach this doorway's pixels.
    function block(index,x,z,level){const at=index*3;blocks[at]=x;blocks[at+1]=z;blocks[at+2]=level;}
    function bind(p){
      gl.useProgram(p);
      const f=(k,v)=>uniform(p,k,'uniform1f',v),v2=(k,v)=>uniform(p,k,'uniform2fv',v),
        v3=(k,v)=>uniform(p,k,'uniform3fv',v),v4=(k,v)=>uniform(p,k,'uniform4fv',v);
      v4('portalCrop',crop);v4('portalPixels',pixelMap);v3('uRight',basis.right);v3('uUp',basis.up);v3('uForward',basis.forward);
      f('uAspect',aspect);f('uFocal',fy);f('uNear2',.1);
      f('uDaylight',light.interiorDaylight);
      if(p===sky)return;
      if(side)v4('portalPlane',[args.camera.right[2]/fx,args.camera.up[2]/fy,args.camera.forward[2],eyeToDoor].map(v=>v*side));
      v4('uApron',[apron.x,apron.z,row.halfX,row.halfZ]);v4('uApronAxes',axes);
      v4('uDoorCenters',roots);v4('uDoorWidths',lanes);f('uApronDatum',GROUND_DATUM);
      v2('uArc',[pose.eastM,pose.northM]);v2('uHomeOffset',[pose.eastM,pose.northM]);
      v4('uTerrainPhase',terrainPhases(pose.eastM,pose.northM));v4('uLandscapePhase',landscapePhases(pose.eastM,pose.northM));
      v4('uTransitionPhase',transitionPhases(pose.eastM,pose.northM));v2('uTerrainGridOffsets[0]',gridOffsets);
      v2('uWindPhase',wind.spatial);v3('uWindTime',wind.temporal);f('uWindMicroPhase',wind.micro);f('uBend',profile.bend);
      f('uEyeAltitude',pose.altitudeM);f('uClearance',clearance);
      v3('uDisturbance',state.disturbance?[state.disturbance.eastM-pose.eastM,state.disturbance.northM-pose.northM,3]:[0,0,0]);
    }
    gl.viewport(0,0,args.width,args.height);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);gl.depthMask(true);gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);
    const atlas=light.reveal>0&&scene.backdrop?.(),recipe=atlas?scene.atlasShader?.()??'':'';
    if(recipe!==skyRecipe){
      const next=program(skyVS,bridgeSkyFragment(recipe,clipAtAperture));
      dropProgram(sky);sky=next;skyRecipe=recipe;
      if(!recipe)releaseBackdrop();
    }
    bind(sky);
    if(clipAtAperture){
      const {camera,aperture}=args;
      uniform(sky,'roadRays','uniformMatrix3fv',false,[
        ...camera.right.map(v=>v/fx),...camera.up.map(v=>v/fy),...camera.forward]);
      uniform(sky,'roadEye','uniform3fv',camera.eye);
      uniform(sky,'roadCenters','uniform4fv',roots);uniform(sky,'roadHalfWidths','uniform4fv',lanes);
      uniform(sky,'roadSurface','uniform3fv',[Math.min(aperture.z,aperture.roadEndZ),Math.max(aperture.z,aperture.roadEndZ),aperture.roadTopY]);
    }
    if(recipe){
      const setters={int:'uniform1i',1:'uniform1f',3:'uniform3fv',4:'uniform4fv'};
      textureBytes=bindMeadowBackdrop(gl,(k,type,v)=>uniform(sky,k,setters[type],v),textures,atlas);
    }
    const skyFrame=atlas||scene.skyFrame||poseFrame(pose);
    for(const [name,value] of [['uEast',skyFrame.east],['uRadial',skyFrame.radial],['uNorth',skyFrame.north]])uniform(sky,name,'uniform3fv',value);
    for(const [k,v] of [['uAltitude',pose.altitudeM],['uReveal',light.reveal],['uDirect',direct],['uDaylight',light.canopyDaylight],['uInteriorLight',light.interiorDaylight]])uniform(sky,k,'uniform1f',v);
    uniform(sky,'uResolution','uniform2fv',[aspect,1]);uniform(sky,'uArc','uniform2fv',[pose.eastM,pose.northM]);
    gl.bindVertexArray(null);gl.drawArrays(gl.TRIANGLES,0,3);draws++;
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);bind(ground);
    uniform(ground,'uCamera','uniform3fv',[0,pose.altitudeM,0]);uniform(ground,'uPaved','uniform1i',1);
    uniform(ground,'uTrench','uniform2fv',[roots[2],lanes[2]]);uniform(ground,'uSiteOffset','uniform2fv',[pose.eastM,pose.northM]);
    uniform(ground,'uTexturePhase','uniform3fv',[pose.eastM*1.7,pose.northM*1.3,pose.eastM*7+pose.northM*3].map(a=>a%(2*Math.PI)));
    uniform(ground,'uSurfaceOrigin','uniform2fv',surface.origin);uniform(ground,'uSurfaceBlockLow','uniform2uiv',surface.low);uniform(ground,'uSurfaceBlockHigh','uniform2uiv',surface.high);
    for(const [k,v] of [['uAlpha',1],['uGround',1],['uReveal',light.reveal],['uCoverHeight',profile.height[1]],['uCover',state.grassbox?1:0]])uniform(ground,k,'uniform1f',v);
    for(let level=0;level<TERRAIN_GRID.levels;level++){
      const pitch=TERRAIN_GRID.basePitch*2**level;
      for(let z=-24;z<24;z+=groundBlock)for(let x=-24;x<24;x+=groundBlock){
        if(level>0&&x>=-12&&x<12&&z>=-12&&z<12)continue;
        if(visible((x+groundBlock/2)*pitch,(z+groundBlock/2)*pitch,(groundBlock/2+1)*pitch))block(terrainBlocks++,x,z,level);
      }
    }
    if(terrainBlocks){
      uploadBlocks(terrainBlocks);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArraysInstanced(gl.TRIANGLES,0,groundBlock*groundBlock*6,terrainBlocks);gl.disable(gl.BLEND);draws++;
    }
    if(row.verge){
      const plane=side?[args.camera.right[2]/fx,args.camera.up[2]/fy,args.camera.forward[2],eyeToDoor].map(v=>v*side):undefined;
      draws+=vergeView.draw(row.verge,pose,basis,{fx,fy,near2:.1,ground:GROUND_DATUM,light:light.interiorDaylight,clock:state.windTime,crop,plane});
    }
    if(!args.near&&!args.retain)releaseNear();
    if(args.near&&clearance<140){
      offsets??=new Float32Array(162);seeds??=new Uint32Array(81);
      const wide=state.grassReach==='wide',radius=wide?STAGE.tileRadius:2,tx=Math.floor(pose.eastM/16),tz=Math.floor(pose.northM/16);
      const cellKey=tx+'/'+tz+'/'+radius;
      if(tileKey!==cellKey){
        tiles=[];for(let z=tz-radius;z<=tz+radius;z++)for(let x=tx-radius;x<=tx+radius;x++)tiles.push({x,z,seed:hash32('cover-v04:713:16m:'+x+':'+z)});
        tileKey=cellKey;descriptorsBuilt++;
      }
      const allocation=heroAllocation(profile.tufts,state.grassReach);
      for(const extension of wide?[false,true]:[false]){
        let count=0;
        for(const tile of tiles){
          if(!extension&&(Math.abs(tile.x-tx)>2||Math.abs(tile.z-tz)>2))continue;
          const x=tile.x*16-pose.eastM,z=tile.z*16-pose.northM;
          const range=Math.hypot(x+8,z+8);
          if(range-15>(extension?64:32)||(extension&&range+15<22))continue;
          if(!visible(x+8,z+8,10)||!planted(x+8,z+8,10))continue;
          seeds[count]=tile.seed;offsets[count*2]=x;offsets[count*2+1]=z;count++;
        }
        if(!count)continue;
        vegetationPrograms();bind(grass);grassTiles+=count;
        uniform(grass,'uTiles[0]','uniform2fv',offsets,0,count*2);uniform(grass,'uSeeds[0]','uniform1uiv',seeds,0,count);
        uniform(grass,'uRootTufts','uniform1i',profile.tufts);uniform(grass,'uWide','uniform1f',wide?1:0);
        uniform(grass,'uExtension','uniform1f',extension?1:0);uniform(grass,'uProportions','uniform4fv',[...profile.height,...profile.width]);
        const tufts=allocation[extension?'extension':'core'];uniform(grass,'uTufts','uniform1i',tufts);
        gl.bindVertexArray(extension?blades.outerVAO:blades.grassVAO);gl.drawArraysInstanced(gl.TRIANGLES,0,extension?blades.outerVertices:blades.bladeVertices,count*tufts);
        draws++;submittedTufts+=count*tufts;
      }
    }
    // Resolve the same native mid-distance clumps in the flat photograph.
    // Deep inside a station this yields no planted blocks and no shader load.
    const distanceToOutside=Math.min(row.halfX-Math.abs(apron.x),row.halfZ-3500-Math.abs(apron.z));
    if(state.grassbox&&clearance<120&&distanceToOutside<370){
      const anchor=lineageAnchor(pose);
      for(const [level,tier] of STAGE.boxTiers.entries()){
        const foot=canopyAtlasFootprint(pose,tier);let count=0;
        for(let z=0;z<tier.grid;z+=grassBlock)for(let x=0;x<tier.grid;x+=grassBlock){
          const cx=foot.origin[0]+(x+grassBlock/2)*tier.pitch,cz=foot.origin[1]+(z+grassBlock/2)*tier.pitch;
          const half=(grassBlock/2+2)*tier.pitch;
          const range=Math.hypot(cx,cz),diagonal=half*Math.SQRT2;
          if(range-diagonal>tier.fade[3]||range+diagonal<tier.fade[0])continue;
          if(visible(cx,cz,half)&&planted(cx,cz,half))block(count++,x,z,0);
        }
        if(!count)continue;
        clumps??=program(cropGeometry(clumpVS,clipAtAperture),clipAtDoor(cropCoverage(procedural.boxFS),clipAtAperture));
        bind(clumps);const verts=tier.blades*3;
        uniform(clumps,'uOrigin','uniform2fv',anchor.origin);uniform(clumps,'uAnchorLow','uniform2uiv',[anchor.x.low,anchor.z.low]);
        uniform(clumps,'uLevel','uniform1i',level);uniform(clumps,'uCellLow','uniform2uiv',[foot.x.low,foot.z.low]);uniform(clumps,'uCellHigh','uniform2uiv',[foot.x.high,foot.z.high]);
        uniform(clumps,'uPitch','uniform1f',tier.pitch);uniform(clumps,'uFade','uniform4fv',tier.fade);
        uniform(clumps,'uHeight','uniform1f',profile.height[1]);uniform(clumps,'uFullness','uniform1f',state.grassWidthScale);
        uniform(clumps,'verticesPerCell','uniform1i',verts);uploadBlocks(count);
        gl.drawArraysInstanced(gl.TRIANGLES,0,grassBlock*grassBlock*verts,count);draws++;clumpBlocks+=count;
      }
    }
    if(!clumpBlocks&&!args.retain){dropProgram(clumps);clumps=null;}
    return {...inspect(),animated:state.windPlaying!==false&&(clumpBlocks>0||submittedTufts>0)};
  }
  return {draw,inspect,releaseNear,get stats(){return inspect();},dispose:resetResources};
}
