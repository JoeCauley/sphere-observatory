const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const B=require('../meadow-benchmark.js'),fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','meadow-benchmark-v1.json'),'utf8'));
B.fixtureValid(fixture);
assert.equal(fixture.poses.normal.terrainRelativeEyeHeightMetres,1.7);
assert.equal(fixture.poses.grazing.terrainRelativeEyeHeightMetres,.4);
const width=4,height=4,rgba=new Uint8Array(width*height*4),depth=new Uint32Array(width*height).fill(1);
for(let i=0;i<depth.length;i++)depth[i]=2;
const mask={roi:[0,0,1,1],excludedRects:[[0,0,.25,1]],minimumCanopyCoverage:.7,minimumGrassPixels:2,minimumWindChangedPixels:1};
const empty=B.assessCapture({rgba,depth,width,height},mask);assert.equal(empty.reason,'empty-foreground');assert.equal(empty.passesCanopy,false);
for(const pixel of [5,6,9]){rgba[pixel*4]=17;rgba[pixel*4+1]=B.GRASS_ID_GREEN;rgba[pixel*4+2]=0;rgba[pixel*4+3]=255;}
const canopy=B.assessCapture({rgba,depth,width,height},mask);assert.equal(canopy.eligiblePixels,12);assert.equal(canopy.grassPixels,3);assert.equal(canopy.passesCanopy,false);
const live=rgba.slice();live[5*4]=18;const frozen=B.assessWind({rgba,depth,width,height},{rgba,depth,width,height},mask),moving=B.assessWind({rgba,depth,width,height},{rgba:live,depth,width,height},mask);
assert.equal(frozen.reason,'frozen-wind');assert.equal(moving.passesWind,true);assert.equal(B.expectedFailure('far-only',fixture.expectedBaselineFailures).status,'fail');
console.log(JSON.stringify({status:'PASS',fixture:fixture.id,empty:empty.reason,coverage:canopy.coverage,frozen:frozen.reason}));
