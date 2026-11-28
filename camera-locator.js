// Camera telemetry is attached to a presented frame. A pending pack may prepare its
// own reading while the outgoing frame and its coordinates stay on screen.
(() => {
  'use strict';
  const viewport = document.getElementById('viewport'), frames = new WeakMap();
  const panel = document.createElement('div');
  panel.setAttribute('role','group');
  panel.className = 'camera-locator';
  panel.setAttribute('aria-label', 'Camera on the Sphere, with position in kilometres and world-space orientation');
  panel.title = 'Origin at the Sphere centre. Dot = camera, line = look direction. A hollow dot is on the far side. Aim and up are world-space unit vectors.';
  panel.innerHTML = '<svg viewBox="0 0 54 54" width="46" height="46" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width=".8"><circle cx="27" cy="27" r="21"/><ellipse cx="27" cy="27" rx="21" ry="12.12"/><ellipse cx="27" cy="27" rx="21" ry="12.12" transform="rotate(60 27 27)"/><ellipse cx="27" cy="27" rx="21" ry="12.12" transform="rotate(-60 27 27)"/><path d="M24 27h6m-3-3v6"/></g><path class="camera-aim" stroke="#f1c887" stroke-width="1.7"/><circle class="camera-dot" r="2.6" stroke="#ffe2a5" stroke-width="1.4"/></svg>' +
    '<div><div class="camera-columns"><b>Sphere · km</b><span>Aim</span><span>Up</span></div>' +
    ['X','Y','Z'].map(axis => '<div class="camera-columns"><b>'+axis+' <i></i></b><span></span><span></span></div>').join('') +
    '<div class="camera-lens"></div></div>';
  const fields = [...panel.querySelectorAll('.camera-columns')].slice(1).map(row => [row.querySelector('i'), ...row.querySelectorAll('span')]);
  const lens = panel.querySelector('.camera-lens'), dot = panel.querySelector('.camera-dot'), ray = panel.querySelector('.camera-aim');
  const project = v => [(v[0]-v[2])/Math.SQRT2, (v[0]-2*v[1]+v[2])/Math.sqrt(6)];
  const number = (v, digits) => (Math.abs(v)<.5*10**-digits ? 0 : v).toFixed(digits);
  const signed = v => (v>=.000005?'+':'')+number(v,5);
  const write = (el,value) => { if(el.textContent!==value)el.textContent=value; };
  let shown=null;
  function show() {
    const host = window.SphereStageFrame?.cameraHost ?? viewport, s = frames.get(host);
    if(panel.parentNode!==host)host.append(panel);
    panel.hidden = !s;
    if(!s || shown===s)return;
    shown=s;
    for(let i=0;i<3;i++){
      write(fields[i][0], number(s.position[i],3));
      write(fields[i][1], signed(s.forward[i]));
      write(fields[i][2], signed(s.up[i]));
    }
    write(lens,'Seed '+s.seed+' · '+(s.pano?'360° panorama':'HFOV '+number(s.fov,1)+'°'));
    const scale = 21/Math.max(s.radius,Math.hypot(...s.position),1), [px,py] = project(s.position), [fx,fy] = project(s.forward);
    const x=27+px*scale, y=27+py*scale;
    dot.setAttribute('cx',x.toFixed(3)); dot.setAttribute('cy',y.toFixed(3));
    dot.setAttribute('fill',s.position[0]+s.position[1]+s.position[2]>=0?'#ffe2a5':'#172227');
    ray.setAttribute('d','M'+x.toFixed(3)+' '+y.toFixed(3)+'l'+(fx*9).toFixed(3)+' '+(fy*9).toFixed(3));
  }
  function present(host,s) {
    if(!host||!s?.position||!s.forward||!s.up)return;
    const old=frames.get(host), pano=s.projection==='panorama';
    if(!old || old.fov!==s.fov || old.radius!==s.radius || old.seed!==s.seed || old.pano!==pano ||
       ['position','forward','up'].some(k=>s[k].some((v,i)=>old[k][i]!==v))){
      frames.set(host,{position:[...s.position],forward:[...s.forward],up:[...s.up],radius:s.radius,seed:s.seed,fov:s.fov,pano});
    }
    show();
  }
  window.SphereCameraLocator = {present, show};
})();
