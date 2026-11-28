import {MillClock,localJournal} from '../../kit/mill-clock.mjs';
import {millAddress,freshMill,counts,cycleMs,refusal} from '../../kit/rolling-mill.mjs';
import {transfer} from './transfer.js';
import {atPanel} from './mill-site.js';
import {DATUM_M} from './facility.js';

export function connectMill(player,status,focus) {
  const $=id=>document.getElementById(id),frame=window.frameElement;
  const world=frame?.dataset.worldKey??'standalone',instance=frame?.dataset.locationId??'infinite-industry';
  const address=millAddress(world,instance,transfer.destination),fallback={address,record:freshMill(),atMs:0,remainingMs:0,ready:false};
  const owner=frame?.dataset.worldKey?parent.SphereProduction:null;
  let clock,soloPlaying=true,notice='',previous='',wasNear=false,noticeJob=null,disposed=false;
  const view=()=>clock?.view(address)??fallback,near=()=>atPanel(player().pose,DATUM_M);
  async function connect(){
    if(owner){clock=await owner.select(world);await clock.refresh();}
    else{
      const key='sphere-industry-production:'+world;
      clock=new MillClock(localJournal(localStorage,key),localStorage,key+':pending');await clock.open();
    }
    if(!disposed)refresh();
  }
  connect().catch(e=>{notice=e.message;});
  function refresh(){
    const show=near();$('millPanel').hidden=!show;
    if(show&&!wasNear)status('R1 forming bay. Feed and dispatch at the green desk.');
    wasNear=show;if(!show)return;
    const v=view(),r=v.record,[stock,busy,rack,shipped]=counts(r);
    if(noticeJob&&noticeJob!==r.job?.id){notice='';noticeJob=null;}
    const time=(v.remainingMs/1000).toFixed(1);
    const problem=!v.ready?(v.error||'Opening mill journal…'):!v.playing?'World time is paused.':r.paused?'Machinery is paused.':'';
    const phase=busy?(v.remainingMs>cycleMs*.76?'Feeding slab':v.remainingMs>cycleMs*.6?'Rolling strip':v.remainingMs>cycleMs*.16?'Winding coil':'Racking coil'):'Mill idle';
    const line=problem || (busy?phase+' · '+time+' s':refusal(r,'feed')||'Ready to feed');
    const key=[line,stock,rack,shipped,notice,r.paused,v.playing].join('|');
    if(previous===key)return;previous=key;
    $('millPhase').textContent=line;
    $('millCounts').textContent=!v.ready?'Reading inventory…':stock+' waiting · '+busy+' in mill · '+rack+'/2 on rack · '+shipped+' shipped';
    $('millNotice').textContent=notice;$('millNotice').hidden=!notice;
    $('millWorld').textContent=v.playing?'Pause world':'Run world';
    $('millMachinery').textContent=r.paused?'Resume machinery':'Pause machinery';
  }
  async function perform(verb,requirePanel=true){
    if(requirePanel&&!near())return;
    if(!clock){notice='Opening mill journal…';refresh();return;}
    const reason=await clock.act(address,instance,verb);
    if(disposed)return;
    notice=reason||(verb==='feed'?'Slab admitted.':verb==='dispatch'?'Coil dispatched.':'');
    noticeJob=view().record.job?.id??null;
    if(!reason&&(verb==='pause'||verb==='resume'))player().processPlaying=verb==='resume';
    refresh();if(requirePanel)focus();
  }
  $('millFeed').onclick=()=>perform('feed');$('millDispatch').onclick=()=>perform('dispatch');
  $('millMachinery').onclick=()=>perform(view().record.paused?'resume':'pause');
  $('millWorld').onclick=()=>{
    if(owner)parent.SphereApp.setPlaying(!parent.SphereApp.playing);else soloPlaying=!soloPlaying;
    notice='';noticeJob=null;refresh();focus();
  };
  return {near,view,refresh,perform,step(dt){if(!owner)clock?.step(dt,soloPlaying);},
    dispose(){disposed=true;if(!owner)clock?.close();}};
}
