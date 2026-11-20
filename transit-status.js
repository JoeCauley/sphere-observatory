/* Short-lived owners keep overlapping Main and pack preparation messages independent. */
(() => {
  const panel = document.createElement('section');
  panel.id = 'travelCurtain';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby','transitTitle');
  panel.innerHTML = '<div class="transit-card"><div class="transit-mark" aria-hidden="true"></div><div><h2 id="transitTitle"></h2><p id="transitPhase" role="status" aria-live="polite"></p><progress aria-label="Destination preparation"></progress><div class="transit-actions"></div></div></div>';
  const viewport=document.getElementById('viewport');
  document.body.append(panel);
  function positionPanel(){
    if(panel.hidden)return;
    const host=document.fullscreenElement||document.body;
    if(panel.parentElement!==host)host.append(panel);
    const rect=viewport.getBoundingClientRect();
    Object.assign(panel.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
  }
  new ResizeObserver(positionPanel).observe(viewport);
  window.addEventListener('resize',positionPanel);
  window.addEventListener('scroll',positionPanel,true);
  document.addEventListener('fullscreenchange',positionPanel);
  const title = panel.querySelector('h2'), phase = panel.querySelector('p');
  const progress = panel.querySelector('progress'), actions = panel.querySelector('.transit-actions');
  const owners = new Set();
  function draw() {
    const item = [...owners].at(-1);
    panel.hidden = !item;
    if (!item) { actions.replaceChildren(); return; }
    if (title.textContent !== item.title) title.textContent = item.title;
    if (phase.textContent !== item.phase) phase.textContent = item.phase;
    progress.hidden = !!item.finished;
    if (item.total > 0) { progress.max = item.total; progress.value = item.ready; }
    else progress.removeAttribute('value');
    if (actions.dataset.owner !== String(item.number)) {
      actions.dataset.owner = String(item.number);
      actions.replaceChildren(...item.buttons.map(([label,fn])=>{
        const b=document.createElement('button'); b.type='button'; b.textContent=label; b.onclick=fn; return b;
      }));
    }
  }
  let serial=0;
  function begin(title,phase,buttons=[],finished=false) {
    const item={title,phase,buttons,finished,number:++serial};
    owners.add(item);draw();positionPanel();
    return {update(phase,ready,total){Object.assign(item,{phase,ready,total});draw();},end(){owners.delete(item);draw();}};
  }
  let trip,request;
  window.addEventListener('sphere-travel-status',({detail:s})=>{
    if (s.state==='preparing') {
      if (!trip || request!==s.id) {
        trip?.end();request=s.id;
        trip=begin(s.title||'Preparing your destination',s.phase,s.stageTrip?[]:[['Cancel trip',()=>window.SphereJourney.travel.cancel()]]);
      }
      trip.update(s.phase,s.ready,s.total);
    } else {
      trip?.end();trip=null;
      if(!s.stageTrip && (s.state==='failed'||s.state==='committed-uncertain')){
        const buttons=s.state==='failed'?[['Retry',()=>window.SphereJourney.travel.retry()]]:[];
        buttons.push(['Dismiss',()=>{trip?.end();trip=null;}]);
        trip=begin(s.title||'Travel interrupted',[s.error,s.recoveryError].filter(Boolean).join(' '),buttons,true);
      }
    }
  });
  window.addEventListener('sphere-biome-world-leaving',()=>{trip?.end();trip=null;});
  window.SphereTransitStatus={begin,paint:()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))};
})();
