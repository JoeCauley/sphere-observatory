import {atmosphere, makeCloudPainter} from './atmosphere.js';

function smooth(low, high, value) {
  const t=Math.min(1,Math.max(0,(value-low)/(high-low)));
  return t*t*(3-2*t);
}

export function veilAt(blind,heightM) {
  if (!blind) return 0;
  return smooth(blind.baseM-blind.edgeM,blind.baseM,heightM)
    *(1-smooth(blind.topM,blind.topM+blind.edgeM,heightM));
}

export function createVeil(doc,blind,profile='meadow-mist') {
  if (!blind) return {draw:()=>0,dispose(){}};
  const recipe=atmosphere(profile);
  let painter;
  return {
    draw(heightM,timeMs,light=1) {
      const value=veilAt(blind,heightM);
      if(value && !painter){
        const canvas=doc.createElement('canvas');
        Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'1'});
        const world=doc.getElementById('world');
        (world?.parentNode??doc.body).insertBefore(canvas,world?.nextSibling??null);
        painter=makeCloudPainter(canvas);
      }
      painter?.draw(value,timeMs,heightM,recipe,0,light);
      return value;
    },
    dispose(){painter?.dispose();}
  };
}
