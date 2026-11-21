import {PackHost} from '../../runtime/v1/host.js';
import {ResourceLease} from '../../runtime/v1/resources.js';

// Meadow's two runtime survey maps are single-level RGBA textures. The v1
// host still retires every handle and restores the original WebGL methods.
class AtlasLease extends ResourceLease {
  constructor(gl,budget){
    const upload=gl.texImage2D.bind(gl);
    super(gl,budget);
    this.peakTextureBytes=0;
    gl.texImage2D=(...args)=>{
      const [target,level,internal,width,height,border,format,type,data]=args;
      const stride=internal===gl.RGBA8 && type===gl.UNSIGNED_BYTE?4:
        internal===gl.RGBA32F && type===gl.FLOAT?16:0;
      if(args.length!==9 || target!==gl.TEXTURE_2D || level!==0 || !stride || border!==0 ||
          format!==gl.RGBA || !Number.isSafeInteger(width) || width<=0 || !Number.isSafeInteger(height) || height<=0)
        throw Error('Unsupported survey texture allocation');
      const size=width*height*stride,tex=gl.getParameter(gl.TEXTURE_BINDING_2D),owned=this.live.get('textures');
      if(!owned.has(tex) || !ArrayBuffer.isView(data) || data.byteLength!==size)throw Error('Invalid survey texture upload');
      const total=this.textureBytes()-owned.get(tex)+size;
      if(total>budget.gpuTextureBytes)throw Error('Survey texture budget exceeded');
      upload(...args);owned.set(tex,size);this.peakTextureBytes=Math.max(this.peakTextureBytes,total);
    };
    this.wrap('generateMipmap',()=>{throw Error('Survey textures have a single level');});
  }
  textureBytes(){return [...this.live.get('textures').values()].reduce((total,n)=>total+n,0);}
  inspect(){return {...super.inspect(),textureBytes:this.textureBytes(),peakTextureBytes:this.peakTextureBytes};}
}
export class AtlasHost extends PackHost {
  trackContext(gl){
    if(this.leases.length)throw Error('Only one resident graphics context is supported');
    const lease=new AtlasLease(gl,this.manifest.budgets);
    this.leases.push(lease);return lease;
  }
}
