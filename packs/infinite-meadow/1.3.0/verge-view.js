// Draw addressed vegetation in the field and through the station aperture.
// Vertex IDs describe branches, crowns and blossoms, so this pass owns no vertex buffers.
const common=`
precision highp float;precision highp int;
uniform vec3 rightAxis,upAxis,forwardAxis;
uniform vec4 lens,portalPlane;uniform vec2 eye;uniform vec4 plants[40];
uniform float clock,near2,daylight;
out vec3 pigment;out vec3 normal;out vec3 surfacePoint;out float aperture;
const float tau=6.283185307;
float hash(float a){return fract(sin(mod(a,8192.)*51.37+13.9)*4375.8);}
vec2 dir(float a){return vec2(cos(a),sin(a));}
void projectPlant(vec3 p,vec3 n,vec3 c){vec3 eyePoint=vec3(p.x,p.y-eye.x,p.z);
 float depth=dot(eyePoint,forwardAxis);gl_Position=vec4(dot(eyePoint,rightAxis)*lens.x,dot(eyePoint,upAxis)*lens.y,depth*1.00000002-near2,depth);
 aperture=dot(portalPlane,vec4(gl_Position.xyw,1.));
 gl_Position.xy=(gl_Position.xy-gl_Position.w*lens.zw)/cropScale;
 normal=n;pigment=c;surfacePoint=p;
}
`;
const header='#version 300 es\nuniform highp vec2 cropScale;\n'+common;
const treeVS=header+`
void main(){
 vec4 plant=plants[gl_InstanceID];float H=plant.z,phase=plant.w;int i=gl_VertexID,v=i%6;
 float u=float(v==1||v==2||v==4),upper=float(v==2||v==4||v==5);
 vec3 at,n,c;vec2 origin=plant.xy;
 if(i<288){
  int stick=i/48;float angle=phase+(float((i/6)%8)+u)*tau/8.;
  float branch=phase+float(stick%3)*2.17;vec2 d=dir(branch);
  vec3 a=vec3(0.),b=vec3(.018,.32,-.012);float ra=.049,rb=.043;
  if(stick>0&&stick<4){a=b;b=vec3(d.x*.19,.73+float(stick%2)*.09,d.y*.19);ra=.037;rb=.018;}
  if(stick>=4){d=dir(phase+(stick==4?2.17:4.34));a=vec3(d.x*.04,.41,d.y*.04);
   d=dir(phase+(stick==4?2.88:5.13));b=vec3(d.x*.27,stick==4?.62:.55,d.y*.27);ra=.026;rb=.008;}
  vec3 axis=normalize(b-a),side=normalize(cross(axis,vec3(1,0,0))),other=cross(axis,side);
  n=side*cos(angle)+other*sin(angle);at=H*(mix(a,b,upper)+mix(ra,rb,upper)*n);
  c=mix(vec3(.24,.171,.106),vec3(.39,.32,.21),.3+.55*abs(n.x));
 }else{
  i-=288;int crown=i/240,row=(i/60)%4,sector=(i/6)%10;
  float lat=-1.5708+(float(row)+upper)*3.14159/4.,angle=phase+(float(sector)+u)*tau/10.;
  float bearing=phase+float(crown)*2.39996;
  vec2 d=dir(bearing);float reach=crown<3?.19:.23+.035*hash(float(crown)+phase);
  float h=crown<3?.78+.045*float(crown):.63+.08*hash(float(crown*3)+phase);
  float radius=crown<3?.235:.17;
  float irregular=.88+.13*sin(3.*angle+bearing)*cos(lat)+.06*cos(5.*angle+phase);
  n=vec3(cos(angle)*cos(lat),sin(lat),sin(angle)*cos(lat));
  at=H*(vec3(d.x*reach,h,d.y*reach)+vec3(n.x*radius,n.y*radius*.69,n.z*radius)*irregular);
  float leaf=hash(float(crown)*11.+phase);
  c=mix(vec3(.064,.157,.031),vec3(.153,.239,.061),leaf*.75+max(n.y,0.)*.25);
 }
 projectPlant(at+vec3(origin.x,eye.y,origin.y),n,c);
}`;
const flowerVS=header+`
void main(){
 int bed=gl_InstanceID/48,stem=gl_InstanceID%48;vec4 plant=plants[bed];
 float seed=float(stem)*7.7+plant.w,angle=hash(seed+3.)*tau;
 vec2 offset=vec2(1.,.58)*dir(angle)*sqrt(hash(seed+5.))*plant.z;
 float ca=cos(plant.w),sa=sin(plant.w);offset=mat2(ca,sa,-sa,ca)*offset;
 vec2 pos=plant.xy+offset;float height=1.03+.48*hash(seed+7.);
 float kind=floor(plant.w/8.);vec2 lean=dir(seed)*.08+vec2(.05,.035)*sin(clock*1.48+seed);
 vec3 foot=vec3(pos.x,eye.y,pos.y),head=foot+vec3(lean.x,height,lean.y);
 int i=gl_VertexID,v=i%6;vec3 at,n=vec3(.1,1.,.1),c;
 if(i<6){float top=float(v==2||v==4||v==5);float side=(v==1||v==2||v==4)?1.:-1.;
  at=mix(foot,head,top)+rightAxis*side*.009;c=vec3(.13,.27,.054);
 }else if(i<12){
  int j=(i-6)%3;float hand=i<9?1.:-1.;at=mix(foot,head,.48)+vec3(lean.x+hand*(j==1?.07:0.),j==1?.12:(j==2?.14:0.),hand*(j==1?.045:0.));c=vec3(.16,.30,.076);
 }else{
  int j=(i-12)%3,face=(i-12)/3;float a=float(face)*tau/10.+seed;
  float scale=.083+.061*hash(seed+11.);vec2 radial=j==0?dir(a)*scale*.12:dir(a+(j==2?.43:0.))*scale;
  float lift=j==0?0.:.013;
  if(kind<.5)c=j==0?vec3(.97,.62,.068):vec3(.97,.92,.74);
  else if(kind<1.5){c=mix(vec3(.36,.13,.52),vec3(.88,.49,.96),float(face%3)*.45);lift+=float(face%4)*.071;radial*=.74;}
  else c=j==0?vec3(.64,.34,.024):vec3(1.,.72,.088);
  at=head+vec3(radial.x,lift+.28*radial.y,radial.y);
 }
 projectPlant(at,n,c);
}`;
const fs=`#version 300 es
precision highp float;in vec3 pigment,normal,surfacePoint;in float aperture;uniform float daylight;out vec4 color;
void main(){if(aperture<0.)discard;
 vec3 n=normalize(normal);float diffuse=max(0.,dot(n,normalize(vec3(.48,.82,-.32))));
 float size=max(length(dFdx(surfacePoint)),length(dFdy(surfacePoint)));
 float grain=sin(surfacePoint.y*9.4+sin(surfacePoint.x*4.5))*sin(surfacePoint.z*7.1);
 float lit=.032+daylight*(.42+.58*diffuse);
 color=vec4(pow(max(vec3(0.),pigment*lit*(1.+.065*grain*(1.-smoothstep(.08,.45,size)))),vec3(1./2.2)),1.);
}`;
export function createVergeView(gl,compile){
  let trees=null,flowers=null;const data=new Float32Array(160);
  function make(source){
    const p=compile(gl,source,fs),u={};
    for(const name of ['rightAxis','upAxis','forwardAxis','lens','cropScale','portalPlane','eye','plants[0]','clock','near2','daylight'])u[name]=gl.getUniformLocation(p,name);
    return {p,u};
  }
  return {
    draw(verge,pose,basis,{fx,fy,near2,ground,light,clock=0,crop=[0,0,1,1],plane=[0,0,0,1]}){
      if(!verge||Math.hypot(pose.eastM-verge.home.eastM,pose.northM-verge.home.northM)>1650||pose.altitudeM-ground>800)return 0;
      let calls=0;
      for(const beds of [false,true]){
        let count=0;
        for(const p of beds?verge.beds:verge.trees){
          const x=p.eastM-pose.eastM,z=p.northM-pose.northM;
          if(beds&&Math.hypot(x,z,pose.altitudeM-ground)>75+p.spread)continue;
          data.set([x,z,beds?p.spread:p.heightM,beds?8*p.species+p.phase:p.phase],4*count++);
        }
        if(!count)continue;
        const {p,u}=beds?(flowers??=make(flowerVS)):(trees??=make(treeVS));
        gl.useProgram(p);gl.bindVertexArray(null);
        gl.uniform3fv(u.rightAxis,basis.right);gl.uniform3fv(u.upAxis,basis.up);gl.uniform3fv(u.forwardAxis,basis.forward);
        gl.uniform4f(u.lens,fx,fy,crop[0],crop[1]);gl.uniform2f(u.cropScale,crop[2],crop[3]);gl.uniform4fv(u.portalPlane,plane);
        gl.uniform2f(u.eye,pose.altitudeM,ground);gl.uniform1f(u.near2,near2);gl.uniform1f(u.daylight,light);gl.uniform1f(u.clock,clock%8192);
        gl.uniform4fv(u['plants[0]'],data,0,count*4);
        gl.drawArraysInstanced(gl.TRIANGLES,0,beds?42:288+7*240,beds?count*48:count);calls++;
      }
      return calls;
    },
    dispose(){if(trees)gl.deleteProgram(trees.p);if(flowers)gl.deleteProgram(flowers.p);trees=flowers=null;}
  };
}
