/* The field camera saves the active renderer's own physical-pixel frame. */
(() => {
  'use strict';
  const viewport=document.getElementById('viewport'), full=document.getElementById('fullscreen');
  const shutter=document.getElementById('fieldScreenshot'), exit=document.getElementById('fieldExit');
  let active=null, queue=Promise.resolve(), previous=null, exitTimer=0;
  const notice=document.createElement('output');notice.id='fieldNotice';notice.hidden=true;
  notice.setAttribute('role','status');viewport.append(notice);
  let noticeTimer;
  function tell(message){
    if (!fullView()){window.SphereApp?.toast(message);return;}
    clearTimeout(noticeTimer);notice.textContent=message;notice.hidden=false;
    noticeTimer=setTimeout(()=>{notice.hidden=true;},1700);
  }
  const fullView=()=>document.fullscreenElement===document.documentElement;
  const packCanvas=frame=>frame?.contentDocument?.querySelector('body > canvas:not([hidden])');
  const sceneFrame=()=>{
    const outgoing=document.querySelector('#departingStageFrame iframe'), incoming=document.querySelector('#stageFrame iframe');
    return incoming && +incoming.parentElement.style.opacity>=.5 ? incoming : outgoing;
  };
  function surface() {
    const frame=sceneFrame();
    return packCanvas(frame) || viewport.querySelector('canvas[data-station]:not([hidden])') || document.getElementById('view');
  }
  function actualSize(rect) {
    return {width:Math.max(1,Math.round(rect.width*devicePixelRatio)),height:Math.max(1,Math.round(rect.height*devicePixelRatio)),adaptiveScale:1};
  }
  function submit(canvas) {
    const request=active;
    if (!request || request.encoding || canvas!==request.canvas) return;
    if (surface()!==canvas) {request.reject(Error('The active view changed.'));return;}
    if(canvas.width!==request.width || canvas.height!==request.height) return;
    request.encoding=true;
    clearTimeout(request.timer);
    // The frame has been presented. A cold GPU readback can outlast the draw deadline.
    request.timer=setTimeout(()=>request.reject(Error('The renderer did not finish encoding the PNG.')),60000);
    try {
      canvas.toBlob(blob=>blob ? request.resolve(blob) : request.reject(Error('The renderer could not encode the frame.')),'image/png');
    } catch (e) {request.reject(e);}
  }
  async function take() {
    const canvas=surface();
    if (!canvas || !window.SphereApp) throw Error('The field camera is waiting for a world view.');
    const {width,height}=actualSize(canvas.getBoundingClientRect());
    const win=canvas.ownerDocument.defaultView;
    let request;
    try {
      const blob=await new Promise((resolve,reject)=>{
        request={canvas,width,height,resolve,reject,encoding:false};
        request.timer=setTimeout(()=>reject(Error('The scene did not present a full-resolution frame.')),12000);
        active=request;
        win.dispatchEvent(new win.Event('resize'));
        window.SphereApp.draw();
      });
      clearTimeout(request.timer);active=null;
      win.dispatchEvent(new win.Event('resize'));window.SphereApp.draw();
      const response=await fetch('/api/screenshots',{method:'POST',headers:{'Content-Type':'image/png'},body:blob});
      const saved=await response.json();
      if (!response.ok) throw Error(saved.error || 'Screenshot could not be saved.');
      if (saved.width!==width || saved.height!==height) throw Error('The saved camera dimensions changed.');
      return saved;
    } finally {
      clearTimeout(request.timer);
      if(active){active=null;win.dispatchEvent(new win.Event('resize'));window.SphereApp.draw();}
    }
  }
  function capture() {
    const shot=queue.then(take);
    queue=shot.then(saved=>{
      tell('Saved '+saved.name+' in Screenshots ('+saved.width+' × '+saved.height+').');
      window.dispatchEvent(new CustomEvent('sphere-field-shot',{detail:saved}));
    },error=>{
      tell(error.message);
      window.dispatchEvent(new CustomEvent('sphere-field-shot',{detail:{error:error.message}}));
    });
    return shot;
  }
  const focusScene=()=>{const e=sceneFrame();(packCanvas(e)||viewport).focus({preventScroll:true});};
  function showExit() {
    if(!fullView()) return;
    exit.hidden=false;
    clearTimeout(exitTimer);
    exitTimer=setTimeout(()=>{if(document.activeElement!==exit)exit.hidden=true;},1650);
  }
  function pointer(e) {if(e.clientY<42)showExit();}
  function key(e) {
    if(e.code==='PrintScreen' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();e.stopImmediatePropagation();
      if(e.type==='keyup' && !e.repeat) void capture().catch(()=>{});
    }
    if(fullView() && e.type==='keydown' && e.code==='Escape'){
      e.preventDefault();e.stopImmediatePropagation();void document.exitFullscreen();
    }
    if(fullView() && e.type==='keydown' && e.code==='Tab'){showExit();}
  }
  function bind(win) {
    const doc=win.document;
    if(doc.documentElement.hasAttribute('data-field-camera'))return;
    doc.documentElement.setAttribute('data-field-camera','');
    win.addEventListener('keydown',key,true);win.addEventListener('keyup',key,true);win.addEventListener('pointermove',pointer,{passive:true});
    if(win!==window){
      const style=doc.createElement('style');
      style.textContent='html.sphere-world-only body > :not(canvas):not(script){display:none!important} html.sphere-world-only body > canvas{inset:0!important;max-width:none!important;max-height:none!important;}';
      doc.head.append(style);
      doc.documentElement.classList.toggle('sphere-world-only',fullView());
    }
  }
  function setWorldOnly(enabled){
    document.documentElement.classList.toggle('field-full',enabled);
    for(const frame of viewport.querySelectorAll('iframe')){
      frame.contentDocument?.documentElement.classList.toggle('sphere-world-only',enabled);
    }
  }
  async function toggle(){
    if(fullView()) {await document.exitFullscreen();return;}
    setWorldOnly(true);
    try{await document.documentElement.requestFullscreen({navigationUI:'hide'});}
    catch(error){setWorldOnly(false);window.SphereApp?.toast('Fullscreen is unavailable in this window.');}
  }
  full.addEventListener('pointerdown',()=>{const e=document.activeElement;previous=e?.tagName==='IFRAME'?e.contentDocument?.activeElement:e;});
  document.addEventListener('fullscreenchange',()=>{
    const enabled=fullView();
    setWorldOnly(enabled);
    clearTimeout(exitTimer);exit.hidden=true;
    requestAnimationFrame(()=>{
      if(enabled){focusScene();showExit();}
      else if(previous?.isConnected && previous!==document.body && previous!==full){previous.focus({preventScroll:true});}
      else focusScene();
      window.dispatchEvent(new Event('resize'));window.SphereApp?.draw();
    });
  });
  exit.onclick=()=>document.exitFullscreen();
  shutter.onclick=()=>{void capture().catch(()=>{});focusScene();};
  full.onclick=toggle;bind(window);
  // The standard Windows launcher can receive the key before a system capture overlay.
  async function connectNativeKey(){
    if(!/^https?:$/.test(location.protocol))return;
    const health=await fetch('/api/health').then(r=>r.json());
    if(!/^[a-f0-9]{16}$/.test(health.fieldKeys||''))return;
    const tab=Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>b.toString(16).padStart(2,'0')).join('');
    const marker=' [Sphere '+health.fieldKeys+' '+tab+']';
    const events=new EventSource('/api/field-keys?scope='+health.fieldKeys+'&tab='+tab);
    events.addEventListener('open',()=>{if(!document.title.includes(marker))document.title+=marker;});
    events.addEventListener('field-key-state',e=>{shutter.dataset.printScreen=e.data.trim();});
    events.addEventListener('print',()=>{if(document.hasFocus())void capture().catch(()=>{});});
    addEventListener('pagehide',()=>events.close(),{once:true});
  }
  void connectNativeKey().catch(()=>{});

  window.SphereFieldCamera={toggle,capture,bind,submit,need:canvas=>active?.canvas===canvas&&!active.encoding,
    size:rect=>active?actualSize(rect):null};
})();
