import {buildZone} from './geometry.js';
self.onmessage=({data})=>{const start=performance.now();try{const vertices=buildZone(data.build,data.key);self.postMessage({generation:data.generation,key:data.key,vertices,buildMs:performance.now()-start},[vertices.buffer]);}catch(e){self.postMessage({generation:data.generation,key:data.key,error:e.message});}};
