const assert=require('node:assert/strict'),mips=require('../world-textures.js');
const decode=n=>{const v=n/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
// Equal black/white coverage has half the radiance, not display grey 128.
const checker=new Uint8Array(8*8*4);for(let y=0;y<8;y++)for(let x=0;x<8;x++)checker.set([(x+y)%2*255,(x+y)%2*255,(x+y)%2*255,255],(y*8+x)*4);
const chain=mips(checker,8);assert.deepEqual(chain.levels.map(l=>l.size),[8,4,2,1]);assert.deepEqual(chain.mean,[.5,.5,.5]);assert.equal(chain.levels.at(-1).pixels[0],188);assert.deepEqual(chain.levels[0].pixels,checker);
// Every level retains an independently calculated image-wide radiance mean.
const image=Uint8Array.from({length:32*32*4},(_,i)=>i%4===3?255:(i*73+(i>>5)*19)%256),before=image.slice(),expected=[0,0,0];
for(let i=0;i<32*32;i++)for(let c=0;c<3;c++)expected[c]+=decode(image[i*4+c])/(32*32);
const result=mips(image,32);result.mean.forEach((v,c)=>assert(Math.abs(v-expected[c])<1e-7));
for(const level of result.levels){const mean=[0,0,0];for(let i=0;i<level.size**2;i++)for(let c=0;c<3;c++)mean[c]+=decode(level.pixels[i*4+c])/level.size**2;mean.forEach((v,c)=>assert(Math.abs(v-expected[c])<.0035));}
assert.deepEqual(image,before);assert.deepEqual(mips(image,32),result);
assert.throws(()=>mips(image,31));assert.throws(()=>mips(new Uint8Array(4),2));
console.log('PASS Shade linear-radiance mip means, bright subpixel coverage, deterministic output and unchanged input');
