// Original Industry interleaved position/color/normal layout, with CPU-double
// geographic rebasing before the same float upload. No alternate geometry.
export class SharedIndustryBatch {
  constructor(gl,data,anchor) {
    this.gl=gl;this.source=data;this.anchor=anchor;this.count=data.length/9;this.bytes=data.byteLength;this.origin=null;
    this.vao=gl.createVertexArray();this.buffer=gl.createBuffer();
    if(!this.vao||!this.buffer){this.dispose();throw Error('Industry batch allocation failed');}
    try {
      gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);
      for(const [attribute,offset] of [[0,0],[1,12],[5,24]]){gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,3,gl.FLOAT,false,36,offset);}
      gl.bindVertexArray(null);
    } catch(error){this.dispose();throw error;}
  }
  rebase(origin) {
    if(this.origin?.eastM===origin.eastM&&this.origin?.northM===origin.northM)return 0;
    const data=this.source.slice(),east=this.anchor[0]-origin.eastM,north=this.anchor[1]-origin.northM;
    for(let i=0;i<data.length;i+=9){data[i]=this.source[i]+east;data[i+2]=this.source[i+2]+north;}
    const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,data);
    this.origin={eastM:origin.eastM,northM:origin.northM};return data.byteLength;
  }
  replace(data,origin) {
    this.source=data;const gl=this.gl;let allocated=0;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    if(data.byteLength!==this.bytes){gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);this.bytes=data.byteLength;allocated=data.byteLength;}
    this.count=data.length/9;this.origin=null;return allocated+this.rebase(origin);
  }
  draw(){const gl=this.gl;gl.bindVertexArray(this.vao);gl.drawArrays(gl.TRIANGLES,0,this.count);}
  dispose(){if(this.buffer)this.gl.deleteBuffer(this.buffer);if(this.vao)this.gl.deleteVertexArray(this.vao);this.buffer=this.vao=this.source=null;}
}
