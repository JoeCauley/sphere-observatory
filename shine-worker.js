/* Exact existing 192-point first bounce, moved off the animation thread. */
importScripts('math.js','collection.js','biomes.js');
self.onmessage=({data})=>{const {state,key}=data;self.postMessage({key,time:state.time,color:SphereCollection.cavity(state)});};
