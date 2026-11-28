import assert from 'node:assert/strict';
import {projectAperture} from '../packs/kit/bridge-biome.mjs';

const aperture={key:'service',xMin:-2,xMax:2,yMin:0,yMax:4,z:10};
const straight={eye:[0,2,0],right:[1,0,0],up:[0,1,0],forward:[0,0,1],focal:[1,2],width:800,height:400};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6, `${a} versus ${b}`);
const face=projectAperture(straight,aperture);
close(face.pixelWidth,160); close(face.pixelHeight,160); close(face.areaPixels,25600);
assert.equal(projectAperture({...straight,eye:[0,2,11]},aperture),null);
assert.equal(projectAperture(straight,{...aperture,z:5000}),null);

// The centre ray misses but a sliver of the actual aperture is still visible.
const sliver=projectAperture({...straight,eye:[11.5,2,0]},aperture);
close(sliver.pixelWidth,20); close(sliver.pixelHeight,160); close(sliver.ndc[0],-1);

// The near plane cuts across a doorway seen sideways. The camera is almost at
// the jamb. All resulting coordinates must remain finite and inside the image.
const diag=Math.sqrt(.5);
const grazing={...straight,eye:[-1.9,2,9.97],forward:[diag,0,diag],right:[diag,0,-diag]};
const rim=projectAperture(grazing,aperture);
assert.ok(rim && rim.areaPixels>0);
for(const n of rim.ndc) assert.ok(Number.isFinite(n) && Math.abs(n)<=1+1e-6);
close(projectAperture({...straight,eye:[0,2,9.9]},aperture).areaPixels,800*400);
console.log('Bridge Biome aperture projection passed');
