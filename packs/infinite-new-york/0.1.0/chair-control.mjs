import {chairPosition} from './address.mjs';

// A carried chair and its ghost last for one visit. The service retains only the
// previous accepted placement until it accepts a complete, reachable placement.
export function chairControls({panel,button,cancelButton,hint,canvas,endpoint,pose,record,position,adopt,refresh,say,onRelease,signal}) {
  let carry=null,busy=false,lastLabel='';
  const channel=endpoint&&typeof BroadcastChannel==='function'?new BroadcastChannel('sphere-furnishing:'+record().id):null;
  const inside=p=>p.mode==='walk'&&p.eastM>-4&&p.eastM<4&&p.northM> -7&&p.northM<-.27;
  const distance=(p,c)=>Math.hypot(p.eastM-c.x,p.northM-c.z);
  function currentPosition(){return position();}
  function canPlace(p,c){return inside(p)&&distance(p,c)<=1.82&&(Math.abs(p.eastM-c.x)>.50||Math.abs(p.northM-c.z)>.51);}
  function reset(){carry=null;onRelease();}
  function sync(){
    const p=pose(),at=currentPosition(),near=inside(p)&&distance(p,at)<=1.82;
    const show=!!endpoint&&(!!carry||near);if(panel.hidden===show)panel.hidden=!show;
    if(!show)return;
    const toWindow=carry?.command.target==='B',allowed=carry&&canPlace(p,carry.where);
    const text=busy?'Placing…':carry?.uncertain?'Retry placement · E':carry?(toWindow?'Place by window · E':'Place at table · E'):'Pick up chair · E';
    const help=carry?(carry.uncertain?'Check the last move':allowed?'Preview in place':toWindow?'Walk beside the window preview':'Walk beside the table preview'):'Dining chair';
    const label=[text,help,!!carry,!!allowed,busy].join('/');
    if(label!==lastLabel){
      button.textContent=text;hint.textContent=help;cancelButton.hidden=!carry||busy||carry.uncertain;
      button.disabled=busy||!!(carry&&!allowed&&!carry.uncertain);
      lastLabel=label;
    }
  }
  function cancel(){
    if(!carry||busy||carry.uncertain)return;
    reset();say('Chair returned to its last placement.');sync();canvas.focus();
  }
  async function activate(){
    if(busy||!endpoint)return;
    const p=pose(),c=record();
    if(!carry){
      if(!inside(p)||distance(p,currentPosition())>1.82)return;
      const target=c.target==='A'?'B':'A';
      carry={command:{target,actionId:crypto.randomUUID(),expected:c.revision},where:chairPosition(target)};
      sync();canvas.focus();return;
    }
    if(!carry.uncertain&&!canPlace(p,carry.where))return;
    const command=carry.command;
    busy=true;sync();
    try{
      const resp=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),signal});
      const data=await resp.json();
      if(resp.ok||resp.status===409){
        if(data.chair?.id!==record().id)throw Error('Unexpected chair address.');
        adopt(data.chair);reset();
        say(resp.ok?(record().target==='B'?'Chair placed by the window.':'Chair placed at the table.'):'Another visit moved this chair. Its current position is shown.');
        if(resp.ok)channel?.postMessage(record().revision);
      }else if(resp.status>=500){throw Error('Furnishing service unavailable.');}
      else{reset();say(data.error||'This placement was rejected.');}
    }catch(e){
      if(!signal.aborted){carry.uncertain=true;say('Acknowledgement interrupted. Retry the same move.');}
    }finally{busy=false;if(!signal.aborted){sync();canvas.focus();}}
  }
  async function reconcile(){
    try{
      const before=record().revision;await refresh();
      if(!signal.aborted&&record().revision>before&&!busy){
        if(carry){reset();say('The world has a newer chair placement.');}else onRelease();
        sync();
      }
    }catch{if(!signal.aborted)say('Could not refresh the chair.');}
  }
  if(channel)channel.onmessage=event=>{if(event.data>record().revision)void reconcile();};
  window.addEventListener('focus',()=>{if(endpoint)void reconcile();},{signal});
  document.addEventListener('visibilitychange',()=>{if(endpoint&&!document.hidden)void reconcile();},{signal});
  button.onclick=activate;cancelButton.onclick=cancel;
  signal.addEventListener('abort',()=>{channel?.close();carry=null;},{once:true});
  return {sync,activate,cancel,carrying:()=>!!carry,preview:()=>carry?.where,collision:()=>carry?null:currentPosition()};
}
