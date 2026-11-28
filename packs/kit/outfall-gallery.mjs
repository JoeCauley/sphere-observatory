// The Builder service gallery in metres. Water works, valves and process state
// are fitted to these structural bays by each Border facility.
const edge=[.44,.51,.47], iron=[.12,.205,.21], brass=[.57,.35,.17], light=[1,.64,.28];
export const galleryBoxes=[], galleryTubes=[];
for(const side of [-1,1])galleryBoxes.push([side*6.02,3.9,17,1.05,7.8,34,iron,2,true]);
for(let z=1;z<34;z+=3.8){
  for(const side of [-1,1]){
    galleryBoxes.push([side*5.47,3.65,z,.30,7.3,.42,edge,0,true],
      [side*5.25,4.95,z,.25,.75,.4,iron,2],[side*5.08,4.99,z,.09,.42,.23,light,3]);
  }
  galleryBoxes.push([0,7.33,z,11.2,.44,.55,edge,0,true],[-1.22,.014,z,2.55,.028,.075,iron,2]);
}
for(let z=1;z<35;z+=2.5){
  galleryTubes.push([[-4.7,2.2,z-.09],[-4.7,2.2,z+.09],.79,brass]);
  for(const x of [-4.15,-3.43])galleryTubes.push([[x,6.45,z-.1],[x,6.45,z+.1],.38,brass]);
}
galleryTubes.push([[-4.7,2.2,-1.8],[-4.7,2.2,35],.66,iron]);
for(const x of [-4.15,-3.43])galleryTubes.push([[x,6.45,-1],[x,6.45,35],.29,[.30,.39,.36]]);
