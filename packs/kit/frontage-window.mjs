import {mainPose,packPose} from '../../geographic-flight.js';
import {cameraState} from './native-habitat.mjs';
import {nativeFrontageTerrain,stationMouth} from './border-frontage.mjs';
import {frontageFrame} from './station-exterior.mjs';
import {createBridgeBiome,projectAperture} from './bridge-biome.mjs';
import {trialSettings} from './doorway-trial.mjs';
import {lightFor} from './destination-light.mjs';

const vertex=`#version 300 es
out vec2 uv;
void main(){uv=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(uv*2.-1.,0.,1.);}`;
const fragment=`#version 300 es
precision highp float;in vec2 uv;uniform sampler2D landscape;uniform vec4 rect;out vec4 color;
void main(){color=texture(landscape,mix(rect.xy,rect.zw,uv));}`;

function apertures(station){
  return [0,1].flatMap(side=>station.routes.map(route=>{
    const [x,y,z]=side?route.farDoor:route.nearDoor;
    return {key:station.address.key+'/'+side+'/'+route.id,side,route,z,xMin:x-route.door[0]/2,xMax:x+route.door[0]/2,yMin:y,yMax:y+route.door[1]};
  }));
}

// Keep one detailed exterior in residence. Other subpixel or distant openings
// retain the same regional sky and ground. The hall depth pass owns the jambs.
const cityClipMinPixels=16*16;

export function makeFrontageWindow(gl,link,host,border,invalidate){
  const lib=host.SphereBiomeLibrary,stage=host.SphereStageFrame,world=host.SphereWorld,atlas=host.SphereAtlas,app=host.SphereApp;
  let active=null,controller=null,preparing=null,provider=null,error='',phase='',draws=0;
  let waitingForView=false;
  let stationKey=null,doors=[],card=null,program=null,texture=null,rect=null,sampler=null,textureWidth=0,textureHeight=0;
  let observed='',mode='regional',sourceTarget=null,scratchTimer=0,authoredRevision=0;
  let cellSet=new Set(),clipDraws=0,clipRect=null;
  function releaseScratch(){
    if(scratchTimer)clearTimeout(scratchTimer);scratchTimer=0;
    if(texture)gl.deleteTexture(texture);texture=null;textureWidth=textureHeight=0;
    if(sourceTarget){gl.deleteFramebuffer(sourceTarget.fbo);gl.deleteTexture(sourceTarget.color);gl.deleteRenderbuffer(sourceTarget.depth);sourceTarget=null;}
  }
  function release(){
    controller?.abort();controller=null;preparing=null;active=null;waitingForView=false;error='';phase='';observed='';mode='regional';
    const cells=trialSettings(host).cells;cells.released+=cellSet.size;cellSet=new Set();cells.resident=0;cells.drawn=0;clipRect=null;
    card?.dispose();card=null;provider?.dispose();provider=null;
    releaseScratch();if(program)gl.deleteProgram(program);program=null;
  }
  function nativeStamp(){return app.renderer.detailRevision;}
  function nativeBlit(state,w,h,ndc){
    if(!program){
      program=link(vertex,fragment);sampler=gl.getUniformLocation(program,'landscape');rect=gl.getUniformLocation(program,'rect');
    }
    if(!texture){
      texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    }
    const source=stage.drawHabitat(state,w,h,false);
    gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.BLEND);gl.useProgram(program);gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    if(textureWidth!==source.width || textureHeight!==source.height){
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);textureWidth=source.width;textureHeight=source.height;
    }else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.uniform1i(sampler,0);
    gl.uniform4fv(rect,ndc.map(n=>(n+1)/2));gl.drawArrays(gl.TRIANGLES,0,3);gl.bindTexture(gl.TEXTURE_2D,null);gl.depthMask(true);
    observed=nativeStamp();
  }
  function authoredTarget(w,h){
    sourceTarget??={fbo:gl.createFramebuffer(),color:gl.createTexture(),depth:gl.createRenderbuffer()};
    gl.bindFramebuffer(gl.FRAMEBUFFER,sourceTarget.fbo);
    if(sourceTarget.w===w && sourceTarget.h===h)return;
    gl.bindTexture(gl.TEXTURE_2D,sourceTarget.color);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,sourceTarget.color,0);
    gl.bindRenderbuffer(gl.RENDERBUFFER,sourceTarget.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,sourceTarget.depth);
    gl.bindRenderbuffer(gl.RENDERBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,null);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Exterior picture target is incomplete.');
    Object.assign(sourceTarget,{w,h});
  }
  function capture({scene,camera,width,height,ndc,near}){
    // An existing author can render to an ordinary viewport, including with
    // gl_FragCoord. Copy just the projected opening into its reusable card.
    const fx=(ndc[2]-ndc[0])/2,fy=(ndc[3]-ndc[1])/2;
    const scale=Math.min(width/(camera.width*fx),height/(camera.height*fy),1,(near?1536:768)/Math.max(camera.width,camera.height));
    const w=Math.max(1,Math.round(camera.width*scale)),h=Math.max(1,Math.round(camera.height*scale));
    let report;
    if(provider){
      if(fx===1 && fy===1){report=provider.draw({...scene,width,height,focal:camera.focal[1]});}
      else{
        const target=gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
        try{
          authoredTarget(w,h);gl.viewport(0,0,w,h);gl.clearColor(0,0,0,1);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
          report=provider.draw({...scene,width:w,height:h,focal:camera.focal[1]});
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER,sourceTarget.fbo);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,target);
          const pixel=(v,n)=>Math.round((v+1)*n/2);
          const left=Math.min(w-1,pixel(ndc[0],w)),bottom=Math.min(h-1,pixel(ndc[1],h));
          gl.blitFramebuffer(left,bottom,Math.max(left+1,pixel(ndc[2],w)),Math.max(bottom+1,pixel(ndc[3],h)),
            0,0,width,height,gl.COLOR_BUFFER_BIT,gl.LINEAR);
        }finally{gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,width,height);}
      }
    }else nativeBlit(scene.state,w,h,ndc);
    // The projected card owns its pixels. After a short pause discard the
    // full-frame scratch image used by a legacy author or by the native blit.
    if(scratchTimer)clearTimeout(scratchTimer);
    scratchTimer=near?0:setTimeout(releaseScratch,400);
    draws++;
    return report;
  }
  const adapter={draw:capture,dispose(){}};
  function select(station,camera,inside){
    if(stationKey!==station){release();stationKey=station;doors=apertures(station);}
    const eye=camera.eye,at=stationMouth(station,eye[0],eye[2]);
    if(!inside){
      // The apron belongs to this face at every heading. Station geometry
      // masks the exterior wherever the wall fills the view.
      if(at.depth>0 || -at.depth>480 || at.lateral>120 || eye[1]>at.socket[1]+at.route.door[1]+65)return null;
      return {door:doors.find(d=>d.side===at.side && d.route===at.route),outside:true};
    }
    if(eye[2]<=0 || eye[2]>=station.widthM || eye[1]>=station.roofM)return null;
    let best=null,bestScore=0;
    for(const door of doors){
      const projection=projectAperture(camera,door);
      if(!projection || projection.areaPixels<4)continue;
      const face=stage.stationFrontages(border.transport,station,door.route)[door.side];
      if(face.profile==='meadow' && !face.exterior && face.canEnterPack)continue;
      const close=door.route===at.route && door.side===at.side && at.lateral<12 && at.depth<100;
      const score=projection.areaPixels*(close?100:1);
      if(score>bestScore){bestScore=score;best={door,projection,outside:false};}
    }
    return best;
  }
  // Trial alternative: draw the City's own street trace straight into the frame, clipped to the
  // opening's projected rectangle. No scratch target and no picture card; the station's walls
  // draw over everything outside the opening afterwards, as they do over the card.
  function clippedDraw({camera,projection,door,pose,station,item,core,light,trial,direct}){
    if(card){card.dispose();card=null;}releaseScratch();
    const W=camera.width,H=camera.height,[n0,n1,n2,n3]=projection.ndc;
    const x0=Math.max(0,Math.floor((n0+1)*W/2)),y0=Math.max(0,Math.floor((n1+1)*H/2)),x1=Math.min(W,Math.ceil((n2+1)*W/2)),y1=Math.min(H,Math.ceil((n3+1)*H/2));
    if(x1<=x0||y1<=y0){mode='regional';return false;}
    const field=frontageFrame(item.occurrence??atlas.byId(item.plotId),pose,border.transport,station);
    if(trial.mode==='clipped'){
      const at=(x,z)=>packPose(mainPose(core,border,{eastM:x+station.address.chainageM,northM:z-station.widthM/2,altitudeM:pose.altitudeM,yaw:0,pitch:0,mode:'flight'},atlas,world),item,atlas,world,{exactAltitude:true});
      const left=at(door.xMin,door.z),right=at(door.xMax,door.z);
      const now=new Set(provider.frustumCells?.({eye:pose,left,right,rangeM:960})??[]);
      let built=0,reused=0;for(const k of now){if(cellSet.has(k))reused++;else{built++;cellSet.add(k);}}
      const c=trial.cells;c.frames++;c.built+=built;c.reused+=reused;c.drawn=now.size;c.resident=cellSet.size;c.last={built,reused,drawn:now.size};
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,W,H);gl.enable(gl.SCISSOR_TEST);gl.scissor(x0,y0,x1-x0,y1-y0);
    try{provider.draw({pose,time:app.sceneSeconds,field,width:W,height:H,focal:camera.focal[1],direct,light,farM:trial.farM});}
    finally{gl.disable(gl.SCISSOR_TEST);gl.depthMask(true);}
    clipDraws++;draws++;mode='clipped';clipRect=[x0,y0,x1-x0,y1-y0];return true;
  }
  function draw(station,camera,yaw,pitch,direct,inside){
    waitingForView=false;
    const selected=select(station,camera,inside);
    if(!selected){if((inside || camera.eye[2]<=0 || camera.eye[2]>=station.widthM) && active)release();return false;}
    const {door,projection,outside}=selected;
    const face=stage.stationFrontages(border.transport,station,door.route)[door.side];
    const item=face.canEnterPack?lib.entry(face.instanceId):null;
    if(face.instanceId && !face.exterior && !item?.occurrence){if(active)release();return false;}
    if(!face.exterior && app.renderer.preparingView){waitingForView=true;return false;}
    const id=item?.occurrence?.id??item?.id??'biome-'+face.nativeBiome;
    const eye=camera.eye;
    // Far inside a hall the window sees a narrow cone through its opening.
    // Keep its exterior survey camera on that cone, near the actual ground.
    // At walking distances the lens stays at the player's physical eye.
    const depth=Math.abs(eye[2]-door.z),t=inside&&depth>96?1-96/depth:0;
    const px=eye[0]+t*((door.xMin+door.xMax)/2-eye[0]),py=eye[1]+t*((door.yMin+door.yMax)/2-eye[1]),pz=eye[2]+t*(door.z-eye[2]);
    const local={eastM:px+station.address.chainageM,northM:pz-station.widthM/2,altitudeM:py,yaw,pitch,mode:'flight'};
    const core=app.getState(),main=mainPose(core,border,local,atlas,world);
    const pose=item?packPose(main,item,atlas,world,{exactAltitude:true}):null;
    let state=null;
    if(!face.exterior){
      state=item?cameraState(host,item,pose):Object.assign(main,nativeFrontageTerrain(face,core,world),{playing:false,time:app.sceneSeconds});
      state.fov=2*Math.atan(1/camera.focal[0])*180/Math.PI;
    }
    if(active?.face!==face || active.id!==id){
      release();const request=controller=new AbortController();active={id,face,exterior:face.exterior};
      const prepare=async()=>{
        if(face.exterior){
          const base=new URL(lib.pack(item.packId).entry,host.document.baseURI);
          const mod=await import(new URL(face.exterior,base).href);
          if(!request.signal.aborted){
            provider=mod.createExterior({gl,link,instance:item,signal:request.signal,invalidate:()=>{
              if(controller===request){authoredRevision++;invalidate();}
            }});
            if(typeof provider?.draw!=='function'||typeof provider?.dispose!=='function')throw Error('Exterior must supply draw and dispose.');
          }
        }else await app.renderer.prepare(state,{preview:true,signal:request.signal,onProgress:update=>{if(controller===request)phase=update.phase??'';}});
      };
      preparing=prepare().catch(e=>{
        if(controller!==request)return;
        if(e.name==='AbortError'){release();waitingForView=true;invalidate();}
        else error=e.message;
      }).finally(()=>{
        if(controller===request){preparing=null;invalidate();}
      });
    }
    if(preparing||error)return false;
    const trial=trialSettings(host),light=lightFor(trial,direct,core.shellshine);
    // At the 18-by-18-pixel survey mark the direct draw used no card and matched its GPU time.
    if(provider && item?.packId==='sideways-city' && !outside && pose &&
       (trial.mode==='clipped' || (trial.mode==='auto' && projection.areaPixels>=cityClipMinPixels))){
      try{return clippedDraw({camera,projection,door,pose,station,item,core,light,trial,direct});}
      catch(failure){error=failure.message;gl.disable(gl.SCISSOR_TEST);gl.depthMask(true);return false;}
    }
    try{
      card??=createBridgeBiome(gl,{createProvider:()=>adapter});
      const near=outside || depth<=65;
      const revision=provider?authoredRevision:nativeStamp()+(app.renderer.needsFrame?'/'+Math.floor(performance.now()/125):'');
      const visible=card.draw({camera,aperture:door,projection,exterior:outside,near,direct,revision,time:app.sceneSeconds,
        windTime:provider?()=>app.sceneSeconds:undefined,scene:()=>({
        state,pose,time:app.sceneSeconds,light,field:item&&frontageFrame(item.occurrence??atlas.byId(item.plotId),pose,border.transport,station)
      })});
      mode=visible?(outside?'exterior':near?'live':'picture'):'regional';
      return visible;
    }catch(failure){error=failure.message;card?.dispose();card=null;gl.depthMask(true);return false;}
  }
  return {
    draw,reset:release,get pending(){return !!preparing;},get error(){return error;},
    get needsFrame(){return (waitingForView && !app.renderer.preparingView) || !!(active && !active.exterior && !preparing && !error && (app.renderer.needsFrame || observed!==nativeStamp()));},
    get stats(){const s=card?.stats;return {draws,id:active?.id??null,provider:active?.exterior??null,pending:!!preparing,phase,error,
      mode,aperture:s?.activeKey??null,captures:s?.captureCount??0,reuses:s?.reuseCount??0,
      cardBytes:s?.residentBytes??0,scratchBytes:textureWidth*textureHeight*4+(sourceTarget?sourceTarget.w*sourceTarget.h*6:0),
      bytes:(s?.residentBytes??0)+textureWidth*textureHeight*4+(sourceTarget?sourceTarget.w*sourceTarget.h*6:0),
      trial:trialSettings(host).mode,light:trialSettings(host).light,clipDraws,clipRect,cells:{...trialSettings(host).cells}};}
  };
}
