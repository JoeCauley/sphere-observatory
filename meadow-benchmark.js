/* IB-075-A fixed evidence fixture and grass-only diagnostic analysis. */
(function(root){
'use strict';
const REVISION=1,GRASS_ID_GREEN=191;
const finite=(value,name)=>{if(!Number.isFinite(value))throw Error('Invalid '+name);return value;};
const unit=(value,name)=>{finite(value,name);if(value<0||value>1)throw Error('Invalid '+name);return value;};
function fixtureValid(fixture){
 if(!fixture||fixture.schema!==1||fixture.id!=='watershed-open-meadow-baseline-v1')throw Error('Unsupported meadow benchmark fixture');
 if(!Array.isArray(fixture.location?.bankMetres)||fixture.location.bankMetres[0]!==21500||fixture.location.bankMetres[1]!==-5000)throw Error('The benchmark must retain the named Open meadow bank');
 if(fixture.settings?.horizontalFov!==80||fixture.mask?.minimumCanopyCoverage!==.7)throw Error('The benchmark lens and 70% coverage rule are fixed by IB-075-A');
 for(const [name,pose] of Object.entries(fixture.poses||{})){if(!Array.isArray(pose.position)||pose.position.length!==3||!pose.position.every(Number.isFinite)||!Array.isArray(pose.forward)||!Array.isArray(pose.up))throw Error('Invalid benchmark pose '+name);}
 return fixture;
}
function pixelMask({rgba,depth,width,height,mask}){
 if(!(rgba instanceof Uint8Array)||rgba.length!==width*height*4)throw Error('Invalid diagnostic colour pixels');
 if(depth&&(!(depth instanceof Uint32Array)||depth.length!==width*height))throw Error('Invalid terrain depth pixels');
 const roi=mask.roi||[0,0,1,1],excluded=mask.excludedRects||[],out=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=(x+.5)/width,v=(y+.5)/height,inROI=u>=roi[0]&&v>=roi[1]&&u<roi[2]&&v<roi[3],excludedPixel=excluded.some(r=>u>=r[0]&&v>=r[1]&&u<r[2]&&v<r[3]);
  const i=y*width+x,j=i*4,terrain=depth?depth[i]<0xffffffff:true,grass=rgba[j+1]===GRASS_ID_GREEN&&rgba[j+2]===0;
  out.push({eligible:inROI&&!excludedPixel&&terrain,grass});
 }
 return out;
}
function assessCapture(capture,mask){
 const pixels=pixelMask({...capture,mask});let eligible=0,grass=0;for(const pixel of pixels)if(pixel.eligible){eligible++;if(pixel.grass)grass++;}
 const coverage=eligible?grass/eligible:0,minimum=mask.minimumCanopyCoverage??.7;
 const result={eligiblePixels:eligible,grassPixels:grass,coverage,passesCanopy:eligible>0&&grass>=(mask.minimumGrassPixels??1)&&coverage>=minimum,reason:!eligible?'no-eligible-terrain-pixels':grass<(mask.minimumGrassPixels??1)?'empty-foreground':coverage<minimum?'canopy-coverage-below-70-percent':null};
 // Callers performing a pixel comparison need the mask, but reports must not
 // accidentally serialize millions of per-pixel diagnostic records.
 Object.defineProperty(result,'pixels',{value:pixels});return result;
}
function assessWind(before,after,mask){
 const a=assessCapture(before,mask),b=assessCapture(after,mask);let changed=0;
 for(let i=0;i<a.pixels.length;i++)if(a.pixels[i].eligible&&(a.pixels[i].grass||b.pixels[i].grass)){const j=i*4;if(before.rgba[j]!==after.rgba[j]||before.rgba[j+1]!==after.rgba[j+1]||before.rgba[j+2]!==after.rgba[j+2])changed++;}
 return {grassPixels:Math.max(a.grassPixels,b.grassPixels),changedGrassPixels:changed,passesWind:Math.max(a.grassPixels,b.grassPixels)>0&&changed>=(mask.minimumWindChangedPixels??1),reason:Math.max(a.grassPixels,b.grassPixels)===0?'empty-foreground':changed<(mask.minimumWindChangedPixels??1)?'frozen-wind':null};
}
function expectedFailure(control,reasons){const expected=Array.isArray(reasons)?reasons:[];return {status:'fail',control,reason:expected.includes(control)?control:control==='far-only'&&expected.includes('far-only-or-empty-foreground')?'far-only-or-empty-foreground':control==='canopy'&&expected.includes('empty-foreground')?'empty-foreground':'unexpected-control-result'};}
const api={REVISION,GRASS_ID_GREEN,fixtureValid,pixelMask,assessCapture,assessWind,expectedFailure};
root.SphereMeadowBenchmark=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
