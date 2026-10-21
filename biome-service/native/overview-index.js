/* Fixed host-owned SPBX overview kernel candidate. Native qualification pending. */
(function(root){
'use strict';
const SIDE=512,NODES=262144,TREE_BYTES=SIDE*SIDE*16,MAX_GPU_BYTES=10*1024*1024;
function fail(code,message){throw Object.assign(new Error(message),{code,phase:'overview-index'});}
function split(value){if(!Number.isFinite(value))fail('INVALID_FRAME','Nonfinite GPU frame');const hi=Math.fround(value),lo=Math.fround(value-hi);if(!Number.isFinite(hi)||!Number.isFinite(lo))fail('INVALID_FRAME','GPU frame overflows');return [hi,lo];}
function splitVector(value){if(!Array.isArray(value)||value.length!==3)fail('INVALID_FRAME','Three-dimensional frame required');const parts=value.map(split);return {high:parts.map(x=>x[0]),low:parts.map(x=>x[1])};}
function packVerified(indexApi,handle){
 const observation=indexApi.inspect(handle);if(observation.disposed)fail('INDEX_DISPOSED','Cannot stage a disposed ownership index');
 const borrowed=indexApi.copyBytes(handle);try{
  const bytes=borrowed.bytes,view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length<40||String.fromCharCode(...bytes.subarray(0,4))!=='SPBX'||view.getUint32(4,true)!==1)fail('INVALID_INDEX','Verified SPBX byte resource required');
  const count=view.getUint32(8,true),assignmentCount=view.getUint32(12,true);
  if(count<7||count>NODES||assignmentCount>128||bytes.length!==40+count*16||count!==observation.descriptor.nodeCount||assignmentCount!==observation.descriptor.assignmentCount)fail('INVALID_INDEX','SPBX descriptor differs');
  const words=new Uint32Array(count*4);for(let i=0;i<words.length;i++)words[i]=view.getUint32(40+i*4,true);
  return {words,nodeCount:count,assignmentCount,roots:Array.from({length:6},(_,i)=>view.getUint32(16+i*4,true)),digest:observation.descriptor.digest};
 }finally{borrowed.release();}
}
// Double-float operations are fixed source, never selected by imported data.
// Actual compiler/driver behavior still needs admission and pixel-bound proof.
const kernel=`
uniform highp usampler2D uBpsTree;
uniform highp uint uBpsRoots[6];
uniform int uBpsEnabled;
// A host-owned zero XOR forces each rounded intermediate to become bits.
// Its uniform identity is pinned; providers and imported data cannot set it.
uniform highp uint uBpsRoundXor;
float bpsRound(float x){return uintBitsToFloat(floatBitsToUint(x)^uBpsRoundXor);}
vec2 bpsSum(vec2 a,vec2 b){float s=bpsRound(a.x+b.x);float v=bpsRound(s-a.x);float e=bpsRound(bpsRound(bpsRound(a.x-bpsRound(s-v))+bpsRound(b.x-v))+a.y);e=bpsRound(e+b.y);float h=bpsRound(s+e);return vec2(h,bpsRound(e-bpsRound(h-s)));}
vec2 bpsNeg(vec2 a){return -a;}
vec2 bpsSub(vec2 a,vec2 b){return bpsSum(a,-b);}
vec2 bpsProduct(vec2 a,vec2 b){
 float p=bpsRound(a.x*b.x);float ca=bpsRound(4097.*a.x),cb=bpsRound(4097.*b.x);
 float ah=bpsRound(ca-bpsRound(ca-a.x)),al=bpsRound(a.x-ah),bh=bpsRound(cb-bpsRound(cb-b.x)),bl=bpsRound(b.x-bh);
 float e=bpsRound(bpsRound(ah*bh)-p);e=bpsRound(e+bpsRound(ah*bl));e=bpsRound(e+bpsRound(al*bh));e=bpsRound(e+bpsRound(al*bl));e=bpsRound(e+bpsRound(a.x*b.y));e=bpsRound(e+bpsRound(a.y*b.x));e=bpsRound(e+bpsRound(a.y*b.y));
 float h=bpsRound(p+e);return vec2(h,bpsRound(e-bpsRound(h-p)));
}
vec2 bpsQuotient(vec2 a,vec2 b){float q=bpsRound(a.x/b.x);vec2 r=bpsSub(a,bpsProduct(b,vec2(q,0.)));return bpsSum(vec2(q,0.),vec2(bpsRound(bpsRound(r.x+r.y)/b.x),0.));}
vec2 bpsSqrt(vec2 a){float q=bpsRound(sqrt(max(0.,a.x)));if(q==0.)return vec2(0.);vec2 r=bpsSub(a,bpsProduct(vec2(q,0.),vec2(q,0.)));return bpsSum(vec2(q,0.),vec2(bpsRound(bpsRound(r.x+r.y)/bpsRound(2.*q)),0.));}
bool bpsLess(vec2 a,vec2 b){return a.x<b.x||(a.x==b.x&&a.y<b.y);}
vec2 bpsAbs(vec2 a){return bpsLess(a,vec2(0.))?-a:a;}
vec2 bpsDot(vec3 ah,vec3 al,vec3 bh,vec3 bl){return bpsSum(bpsSum(bpsProduct(vec2(ah.x,al.x),vec2(bh.x,bl.x)),bpsProduct(vec2(ah.y,al.y),vec2(bh.y,bl.y))),bpsProduct(vec2(ah.z,al.z),vec2(bh.z,bl.z)));}
void bpsRayPoint(vec3 ch,vec3 cl,vec3 dh,vec3 dl,out vec3 qh,out vec3 ql){
 vec2 a=bpsDot(dh,dl,dh,dl),b=bpsDot(ch,cl,dh,dl),c=bpsSub(bpsDot(ch,cl,ch,cl),vec2(1.,0.));
 vec2 discriminant=bpsSub(bpsProduct(b,b),bpsProduct(a,c));
 if(bpsLess(discriminant,vec2(0.))){qh=vec3(0.);ql=vec3(0.);return;}
 vec2 z=bpsSqrt(discriminant),stable=bpsLess(b,vec2(0.))?bpsSub(z,b):-bpsSum(b,z);
 vec2 nearRoot=bpsQuotient(stable,a),otherRoot=stable.x==0.&&stable.y==0.?vec2(0.):bpsQuotient(c,stable);
 bool nearPositive=bpsLess(vec2(0.),nearRoot),otherPositive=bpsLess(vec2(0.),otherRoot);
 if(!nearPositive&&!otherPositive){qh=vec3(0.);ql=vec3(0.);return;}
 vec2 t=nearPositive&&otherPositive?(bpsLess(nearRoot,otherRoot)?nearRoot:otherRoot):nearPositive?nearRoot:otherRoot;
 vec2 x=bpsSum(vec2(ch.x,cl.x),bpsProduct(t,vec2(dh.x,dl.x)));
 vec2 y=bpsSum(vec2(ch.y,cl.y),bpsProduct(t,vec2(dh.y,dl.y)));
 vec2 zq=bpsSum(vec2(ch.z,cl.z),bpsProduct(t,vec2(dh.z,dl.z)));
 qh=vec3(x.x,y.x,zq.x);ql=vec3(x.y,y.y,zq.y);
}
uint bpsGrid(vec2 ratio){
 vec2 scaled=bpsProduct(bpsSum(ratio,vec2(1.,0.)),vec2(536870912.,0.));
 int base=int(floor(scaled.x));float rest=bpsRound(bpsRound(scaled.x-float(base))+scaled.y);
 int exact=base+int(floor(rest));if(exact==1073741824)return 1073741823u;
 return uint(exact);
}
uint bpsOwner(vec3 qh,vec3 ql){
 if(uBpsEnabled==0)return 0u;
 vec2 x=vec2(qh.x,ql.x),y=vec2(qh.y,ql.y),z=vec2(qh.z,ql.z),ax=bpsAbs(x),ay=bpsAbs(y),az=bpsAbs(z),u,v,den;
 int face;
 if(!bpsLess(ax,ay)&&!bpsLess(ax,az)){face=bpsLess(x,vec2(0.))?1:0;den=ax;u=face==0?-z:z;v=y;}
 else if(!bpsLess(ay,az)){face=bpsLess(y,vec2(0.))?3:2;den=ay;u=x;v=face==2?-z:z;}
 else{face=bpsLess(z,vec2(0.))?5:4;den=az;u=face==4?x:-x;v=y;}
 if(den.x==0.)return 0u;
 uint gx=bpsGrid(bpsQuotient(u,den)),gy=bpsGrid(bpsQuotient(v,den)),node=uBpsRoots[face];
 for(int depth=0;depth<30;depth++){
  uint bit=uint(29-depth),child=((gx>>bit)&1u)+2u*((gy>>bit)&1u);
  uvec4 words=texelFetch(uBpsTree,ivec2(int(node&511u),int(node>>9u)),0);
  uint word=child==0u?words.x:child==1u?words.y:child==2u?words.z:words.w;
  if(word==0u)return 0u;if((word&2147483648u)!=0u)return word&2147483647u;node=word;
 }
 return 0u;
}
`;
const api=Object.freeze({SIDE,NODES,TREE_BYTES,MAX_GPU_BYTES,split,splitVector,packVerified,kernel});root.SphereBiomeOverviewIndex=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
