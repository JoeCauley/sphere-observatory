// Opt-in validation only. Reads the real default framebuffer after the ordinary
// combined draw; no replacement scene, camera, simulation or rendering path.
export class DisplayComparison {
  constructor(gl,canvas){this.gl=gl;this.canvas=canvas;this.baseline=null;this.pending=null;this.result={status:'idle',retainedBytes:0};this.closed=false;}
  request(parameters){if(this.closed)return;const kind=parameters.get('capture');if(kind==='baseline'||kind==='compare')this.pending={kind,id:parameters.get('sample')??kind};}
  capture(fingerprint,frame){
    if(this.closed||!this.pending)return;const request=this.pending;this.pending=null;
    const gl=this.gl,width=this.canvas.width,height=this.canvas.height,bytes=width*height*4;
    try{
      if(!Number.isSafeInteger(bytes)||bytes<=0||bytes>67108864)throw Error('Comparison image exceeds its 64 MiB readback limit');
      if(gl.isContextLost()||gl.getParameter(gl.FRAMEBUFFER_BINDING)!==null||gl.getError()!==gl.NO_ERROR)throw Error('Comparison requires the healthy ordinary default framebuffer');
      const pixels=new Uint8Array(bytes);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      if(gl.getError()!==gl.NO_ERROR)throw Error('Native framebuffer readback failed');
      if(request.kind==='baseline'){
        this.baseline={pixels,fingerprint,width,height};this.result={status:'baseline',sample:request.id,frame,width,height,readBytes:bytes,retainedBytes:bytes};
      }else{
        const prior=this.baseline;if(!prior||prior.width!==width||prior.height!==height||prior.fingerprint!==fingerprint)throw Error('Comparison camera or world state differs from baseline');
        let differentPixels=0,maximumChannelDelta=0;for(let i=0;i<bytes;i+=4){let changed=false;for(let k=0;k<4;k++){const delta=Math.abs(pixels[i+k]-prior.pixels[i+k]);maximumChannelDelta=Math.max(maximumChannelDelta,delta);changed||=delta!==0;}if(changed)differentPixels++;}
        this.result={status:'compared',sample:request.id,frame,width,height,readBytes:bytes,differentPixels,maximumChannelDelta,equal:differentPixels===0,retainedBytes:prior.pixels.byteLength};
      }
    }catch(error){this.result={status:'refused',sample:request.id,frame,reason:String(error.message),retainedBytes:this.baseline?.pixels.byteLength??0};}
  }
  inspect(){return {...this.result,pending:this.pending?.id??null,disposed:this.closed};}
  dispose(){this.closed=true;this.pending=null;this.baseline=null;this.gl=this.canvas=null;this.result={status:'disposed',retainedBytes:0};}
}
