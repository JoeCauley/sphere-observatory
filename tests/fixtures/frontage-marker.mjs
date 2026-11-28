// A test author places one gold-capped blue post 150 m outside the service door.
export function createExterior({gl,link,instance,invalidate}){
  const program=link(`#version 300 es
  out vec2 ndc;void main(){ndc=vec2((gl_VertexID<<1)&2,gl_VertexID&2)*2.-1.;gl_Position=vec4(ndc,0.,1.);}`,
  `#version 300 es
  precision highp float;in vec2 ndc;uniform vec2 centre,extent;uniform bool finished;out vec4 color;
  void main(){vec2 p=(ndc-centre)/extent;vec3 c=vec3(.04,.09,.10);
  if(abs(p.x)<1.&&abs(p.y)<1.)c=p.y>.5?(finished?vec3(.15,1.,.22):vec3(1.,.78,.05)):vec3(.04,.34,.95);color=vec4(c,1.);}`);
  const centre=gl.getUniformLocation(program,'centre'),extent=gl.getUniformLocation(program,'extent');
  const finish=gl.getUniformLocation(program,'finished');let complete=false;
  gl.canvas.completeFixturePost=()=>{complete=true;invalidate?.();};
  gl.canvas.dataset.fixtureOwner=instance.id;
  let sampled=false;
  return {
    draw({field,pose,width,height,focal}){
      const dx=field.doors[0]-field.bounds[0],dz=-field.bounds[3]-150-field.bounds[1];
      const [a,b,c,d]=field.axes,det=a*d-b*c,east=(d*dx-b*dz)/det,north=(a*dz-c*dx)/det;
      const sy=Math.sin(pose.yaw),cy=Math.cos(pose.yaw),sp=Math.sin(pose.pitch),cp=Math.cos(pose.pitch);
      const ground=east*sy-north*cy,rise=5-pose.altitudeM,depth=ground*cp+rise*sp;
      const right=east*cy+north*sy,up=rise*cp-ground*sp;
      const origin=depth>0?[right*focal*height/(depth*width),up*focal/depth]:[4,4];
      gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.useProgram(program);gl.bindVertexArray(null);
      gl.uniform1i(finish,complete);gl.uniform2fv(centre,origin);gl.uniform2f(extent,2.5*focal*height/(Math.max(1,depth)*width),5*focal/Math.max(1,depth));
      gl.drawArrays(gl.TRIANGLES,0,3);gl.depthMask(true);
      if(!sampled&&origin.every(v=>Math.abs(v)<.98)){const rgba=new Uint8Array(4);gl.readPixels(Math.floor((1+origin[0])*width/2),Math.floor((1+origin[1])*height/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
        gl.canvas.dataset.markerPixel=Array.from(rgba).join(',');sampled=true;}
    },
    dispose(){gl.deleteProgram(program);delete gl.canvas.dataset.fixtureOwner;delete gl.canvas.completeFixturePost;}
  };
}
