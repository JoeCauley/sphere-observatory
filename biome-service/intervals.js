/* Directed 192-bit fixed-point intervals. No empirical Math trig ULP assumption. */
(function(root){
'use strict';
const BITS=192n,SCALE=1n<<BITS,ONE=Object.freeze([SCALE,SCALE]);
function floorDiv(a,b){if(b===0n)throw Error('Interval division by zero');let q=a/b;if(a%b!==0n&&((a<0n)!==(b<0n)))q--;return q;}
function ceilDiv(a,b){return -floorDiv(-a,b);}
function rational(n,d=1n){if(typeof n!=='bigint'||typeof d!=='bigint'||d===0n)throw Error('Invalid exact rational');return [floorDiv(n*SCALE,d),ceilDiv(n*SCALE,d)];}
const bitsBuffer=new ArrayBuffer(8),bitsView=new DataView(bitsBuffer);
function numberRational(value){
 if(!Number.isFinite(value))throw Error('Non-finite interval input');bitsView.setFloat64(0,value,false);const bits=bitsView.getBigUint64(0,false),negative=(bits>>63n)!==0n,exponent=Number((bits>>52n)&2047n),fraction=bits&((1n<<52n)-1n);
 if(exponent===0&&fraction===0n)return [0n,1n];let numerator=(exponent===0?fraction:(1n<<52n)|fraction),shift=(exponent===0?-1074:exponent-1075);if(negative)numerator=-numerator;return shift>=0?[numerator<<BigInt(shift),1n]:[numerator,1n<<BigInt(-shift)];
}
function fromNumber(value){return rational(...numberRational(value));}
function check(a){if(!Array.isArray(a)||a.length!==2||typeof a[0]!=='bigint'||typeof a[1]!=='bigint'||a[0]>a[1])throw Error('Invalid interval');return a;}
function add(a,b){check(a);check(b);return [a[0]+b[0],a[1]+b[1]];}
function neg(a){check(a);return [-a[1],-a[0]];}
function sub(a,b){return add(a,neg(b));}
function mul(a,b){check(a);check(b);const p=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]],lo=p.reduce((x,y)=>x<y?x:y),hi=p.reduce((x,y)=>x>y?x:y);return [floorDiv(lo,SCALE),ceilDiv(hi,SCALE)];}
function div(a,b){check(a);check(b);if(b[0]<=0n&&b[1]>=0n)throw Error('Interval denominator includes zero');const p=[rational(a[0],b[0]),rational(a[0],b[1]),rational(a[1],b[0]),rational(a[1],b[1])];return [p.reduce((x,y)=>x<y[0]?x:y[0],p[0][0]),p.reduce((x,y)=>x>y[1]?x:y[1],p[0][1])];}
function square(a){check(a);const p=a[0]*a[0],q=a[1]*a[1];return [a[0]<=0n&&a[1]>=0n?0n:floorDiv(p<q?p:q,SCALE),ceilDiv(p>q?p:q,SCALE)];}
function integerSqrt(n){if(n<0n)throw Error('Negative integer square root');if(n<2n)return n;let x=1n<<BigInt(Math.ceil(n.toString(2).length/2));for(;;){const y=(x+n/x)>>1n;if(y>=x)return x;x=y;}}
function sqrt(a){check(a);if(a[0]<0n)throw Error('Negative interval square root');const lower=integerSqrt(a[0]*SCALE),upper=integerSqrt(a[1]*SCALE);return [lower,upper*upper===a[1]*SCALE?upper:upper+1n];}
let piCache;
function pi(){if(!piCache)piCache=sub(mul(rational(16n),atan(rational(1n,5n))),mul(rational(4n),atan(rational(1n,239n))));return piCache.slice();}
function atanPoint(x){
 if(x<0n)return neg(atanPoint(-x));if(x===0n)return [0n,0n];
 if(x>SCALE)return sub(div(pi(),rational(2n)),atan(div(ONE,[x,x])));
 // The exact addition identity reduces every series argument to <= 1/2.
 if(x>SCALE/2n){const half=[SCALE/2n,SCALE/2n],point=[x,x];return add(atanPoint(SCALE/2n),atan(div(sub(point,half),add(ONE,mul(point,half)))));}
 const z=[x,x],z2=square(z);let power=z,sum=[0n,0n];
 for(let k=0;k<512;k++){
  const term=div(power,rational(BigInt(2*k+1)));sum=k%2===0?add(sum,term):sub(sum,term);power=mul(power,z2);
  const remainder=div(power,rational(BigInt(2*k+3)))[1];
  if(remainder<=4n){return k%2===0?[sum[0]-remainder,sum[1]]:[sum[0],sum[1]+remainder];}
 }
 throw Error('Interval atan work bound exceeded');
}
function atan(a){check(a);const lower=atanPoint(a[0]),upper=atanPoint(a[1]);return [lower[0],upper[1]];}
function asinPoint(x){
 if(x<0n)return neg(asinPoint(-x));if(x>SCALE)throw Error('Interval asin outside domain');if(x===SCALE)return div(pi(),rational(2n));
 return mul(rational(2n),atan(div([x,x],add(ONE,sqrt(sub(ONE,square([x,x])))))));
}
function asin(a){check(a);if(a[0]<-SCALE||a[1]>SCALE)throw Error('Interval asin outside domain');return [asinPoint(a[0])[0],asinPoint(a[1])[1]];}
function acos(a){return sub(div(pi(),rational(2n)),asin(a));}
function trig(a,cosine){
 check(a);const absolute=a[0]<0n?-a[0]:a[0],other=a[1]<0n?-a[1]:a[1],maximum=absolute>other?absolute:other;if(maximum>16n*SCALE)throw Error('Interval trig work domain exceeded');
 const a2=square(a);let term=cosine?ONE.slice():a.slice(),sum=term.slice(),degree=cosine?0:1;
 let numerator=cosine?maximum:maximum*maximum,denominator=cosine?SCALE:2n*SCALE*SCALE;
 // Taylor's theorem |f^(n)|<=1 supplies the remainder over the entire interval.
 for(let k=1;k<=160;k++){
  const p=degree+1,q=degree+2;term=neg(div(mul(term,a2),rational(BigInt(p*q))));sum=add(sum,term);degree+=2;
  numerator*=maximum*maximum;denominator*=BigInt(degree*(degree+1))*SCALE*SCALE;
  const bound=ceilDiv(numerator*SCALE,denominator);if(bound<=4n||k===160)return [sum[0]-bound,sum[1]+bound];
 }
 throw Error('Interval trig work bound exceeded');
}
function sin(a){return trig(a,false);}function cos(a){return trig(a,true);}
function nextUp(x){if(Number.isNaN(x)||x===Infinity)return x;if(x===0)return Number.MIN_VALUE;bitsView.setFloat64(0,x,false);let bits=bitsView.getBigUint64(0,false);bits+=x>0?1n:-1n;bitsView.setBigUint64(0,bits,false);return bitsView.getFloat64(0,false);}
function nextDown(x){return -nextUp(-x);}
function boundNumber(value,lower){
 let result=Number(value)/Number(SCALE);if(!Number.isFinite(result))throw Error('Interval cannot be represented by finite binary64');
 const [n,d]=numberRational(result);if(lower?n*SCALE>value*d:n*SCALE<value*d)result=lower?nextDown(result):nextUp(result);return result===0?0:result;
}
function toNumbers(a){check(a);return [boundNumber(a[0],true),boundNumber(a[1],false)];}
const api=Object.freeze({PROFILE:'sphere-outward-b192-v1',BITS,SCALE,ONE,fromNumber,numberRational,rational,check,add,sub,neg,mul,div,square,sqrt,integerSqrt,atan,asin,acos,sin,cos,pi,toNumbers,nextUp,nextDown});
root.SphereBiomeIntervals=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
