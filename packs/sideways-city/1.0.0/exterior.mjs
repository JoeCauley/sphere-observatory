import {cityPlaneShaders,lightUniforms} from './streets.mjs';
import {REFERENCE_LIGHT} from '../../kit/destination-light.mjs';
import {local,index,CELL} from './ground.js';

const empty=[0,0,0,0], haze=new Float32Array([0,400,.0005,0,0,4000,.00008,0]);

export function surveyUniforms(gl,u,field){
  gl.uniform4fv(u.uSurvey,field?.bounds??empty);
  gl.uniform4fv(u.uSurveyAxes,field?.axes??empty);
  gl.uniform4fv(u.uDoors,field?.doors??empty);
  gl.uniform4fv(u.uClearance,field?.clearances??empty);
  gl.uniform1f(u.uApronRun,field?.apronRunM??0);
}

export function createExterior({gl,link}){
  const program=link(...cityPlaneShaders),u={};
  for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){
    const name=gl.getActiveUniform(program,i).name;u[name]=gl.getUniformLocation(program,name);
  }
  return {
    draw({pose,width,height,focal,field,time,light,farM=0}){
      const s=Math.sin(pose.yaw),c=Math.cos(pose.yaw),sp=Math.sin(pose.pitch),cp=Math.cos(pose.pitch);
      gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.BLEND);
      gl.useProgram(program);gl.bindVertexArray(null);
      gl.uniform3f(u.uForward,s*cp,sp,c*cp);gl.uniform3f(u.uRight,-c,0,s);gl.uniform3f(u.uUp,-s*sp,cp,-c*sp);
      gl.uniform1f(u.uFocal,focal);gl.uniform1f(u.uAspect,width/height);gl.uniform1f(u.uAltitude,pose.altitudeM);
      gl.uniform4fv(u['uHaze[0]'],haze);gl.uniform3f(u.uBlind,0,0,0);gl.uniform1f(u.uTime,time);
      gl.uniform2i(u.uCell,index(pose.eastM),index(pose.northM));gl.uniform2f(u.uLocal,local(pose.eastM),local(pose.northM));
      gl.uniform1i(u.uMesh,-1);gl.uniform1f(u.uPix,2/(focal*height));surveyUniforms(gl,u,field);
      lightUniforms(gl,u,light??REFERENCE_LIGHT);gl.uniform1f(u.uFarM,farM);
      gl.drawArrays(gl.TRIANGLES,0,3);gl.depthMask(true);
    },
    // Street cells crossed by the opening's horizontal wedge, out to rangeM. The trace visits these
    // with the same placement rules the walkable City meshes; nothing per cell is uploaded.
    frustumCells({eye,left,right,rangeM=960}){
      const out=new Set(),a0=Math.atan2(left.eastM-eye.eastM,left.northM-eye.northM),a1=Math.atan2(right.eastM-eye.eastM,right.northM-eye.northM);
      let da=a1-a0;if(da>Math.PI)da-=2*Math.PI;if(da<-Math.PI)da+=2*Math.PI;
      const rays=Math.min(256,Math.max(8,Math.ceil(Math.abs(da)/.01))),step=CELL/4;
      for(let i=0;i<=rays;i++){const a=a0+da*i/rays,sx=Math.sin(a),sz=Math.cos(a);
        for(let t=0;t<=rangeM;t+=step)out.add(index(eye.eastM+sx*t)+','+index(eye.northM+sz*t));}
      return [...out];
    },
    dispose(){gl.deleteProgram(program);}
  };
}
