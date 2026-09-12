/* In-view controls also remain reachable when the viewport owns browser fullscreen. */
(function(){
'use strict';const A=SphereApp,$=id=>document.getElementById(id),view=$('viewport');
const button=document.createElement('button');button.id='flightConsoleButton';button.textContent='Flight console';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','flightConsole');document.querySelector('.view-actions').prepend(button);
const panel=document.createElement('section');panel.id='flightConsole';panel.hidden=true;panel.setAttribute('aria-label','Flight console');panel.innerHTML=`
 <div class="console-heading"><strong>Flight console</strong><button id="closeFlightConsole" aria-label="Close flight console">×</button></div>
 <div class="console-row"><button id="consolePlay">Play</button><output id="consoleTime" aria-live="off"></output><label>Time rate<select id="consoleRate" aria-label="Flight console time rate"></select></label></div>
 <input id="consoleScrub" type="range" min="-259200" max="259200" step="1" aria-label="Flight console simulation time">
 <div class="console-row"><button id="consoleReset">Reset time</button><button id="consoleAttachment">Follow Shade</button></div>
 <p id="consoleFrame" class="micro"></p>
 <label class="check"><input id="consoleLevel" type="checkbox">Keep level within 1 km <small>L</small></label>
 <div class="console-grid"><label>Flight speed<select id="consoleSpeed" aria-label="Flight console flight speed"></select></label><label>Lens <output id="consoleFovValue"></output><input id="consoleFov" type="range" min="25" max="120" step="1" aria-label="Flight console field of view"></label></div>
 <label>Exposure <output id="consoleExposureValue"></output><input id="consoleExposure" type="range" min="-8" max="8" step="0.1" aria-label="Flight console exposure"></label>
 <div class="console-grid"><label>Materials<select id="consoleMaterials"><option value="1">Detailed</option><option value="0">Simple</option></select></label><label>Structure shadows<select id="consoleShadows"><option value="0">Off</option><option value="1">Balanced</option><option value="2">Fine</option></select></label></div>
 <label>Edge smoothing<select id="consoleAntialias" aria-label="Flight console edge smoothing"></select></label>
 <div class="console-row"><button id="consoleLevelNow">Level now</button><button id="consolePhoto">Save photograph</button></div>
 <p class="micro">Drag to look · W A S D fly · Q / E rise and descend · Shift faster · Space play / pause · H hide controls</p>`;
view.append(panel);const style=document.createElement('style');style.textContent=`
 #flightConsoleButton{width:auto;padding:0 11px;font-size:11px}
 #flightConsole{position:absolute;z-index:12;right:25px;top:112px;width:320px;max-height:calc(100% - 255px);overflow:auto;padding:15px 17px;background:#111b22f5;border:1px solid #53646599;border-radius:6px;box-shadow:0 8px 32px #0006;touch-action:auto;font-size:11px}
 #flightConsole[hidden],body.clean #flightConsole{display:none}
 .console-heading,.console-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
 .console-heading strong{font-weight:500;font-size:14px}.console-heading button{margin-left:auto}
 #flightConsole button{background:#27353e;border:1px solid #53616a;border-radius:4px;font-size:11px;padding:7px 10px}
 #flightConsole button:hover{background:#344b53}#flightConsole button:disabled{cursor:default}
 #flightConsole label{display:block;color:#becacb}#flightConsole .check{display:flex;margin:14px 0}#flightConsole .check small{margin-left:auto;color:#81989a}
 #flightConsole select{padding:6px;font-size:11px;margin-top:4px}#consoleTime{font-variant-numeric:tabular-nums;color:#ddc298}
 .console-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:12px 0}#flightConsole label output{float:right;color:#ddc298}
 #flightConsole .micro{margin-bottom:7px}#viewport:fullscreen #togglePanel{display:none}
 @media(max-height:650px){#flightConsole{top:70px;max-height:calc(100% - 170px)}}
 @media(max-width:760px){#flightConsole{right:12px;width:min(320px,calc(100% - 24px));top:106px}}`;
document.head.append(style);
for(const [target,source] of [['consoleRate','timeRate'],['consoleSpeed','speed'],['consoleAntialias','antialias']])$(target).innerHTML=$(source).innerHTML;
function focus(){view.focus({preventScroll:true});}
function toggle(open=panel.hidden){panel.hidden=!open;button.setAttribute('aria-expanded',String(open));if(open)$('consolePlay').focus();else focus();}
button.onclick=()=>toggle();$('closeFlightConsole').onclick=()=>toggle(false);
panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();toggle(false);}});
function update(key,value){const s=A.getState();s[key]=value;A.setState(s);}
$('consolePlay').onclick=()=>{update('playing',!A.getState().playing);focus();};
$('consoleReset').onclick=()=>{const s=A.getState();s.time=0;s.playing=false;A.setState(s);focus();};
$('consoleScrub').oninput=e=>{const s=A.getState();s.time=Number(e.target.value);s.playing=false;A.setState(s);};
$('consoleAttachment').onclick=()=>{const s=A.getState();s.shadeAttachment=s.shadeAttachment!==null?null:Number(s.siteId.slice(6));A.setState(s);focus();};
$('consoleLevel').onchange=e=>{update('surfaceLock',e.target.checked);focus();};
for(const [id,key]of [['consoleRate','timeRate'],['consoleSpeed','speed'],['consoleFov','fov'],['consoleExposure','exposure']])$(id).addEventListener($(id).type==='range'?'input':'change',e=>update(key,Number(e.target.value)));
$('consoleMaterials').onchange=e=>update('richMaterials',e.target.value==='1');
$('consoleShadows').onchange=e=>update('localShadows',Number(e.target.value));
$('consoleAntialias').onchange=e=>update('antialias',Number(e.target.value));
$('consoleLevelNow').onclick=()=>{$('levelCamera').click();focus();};$('consolePhoto').onclick=()=>{A.capture();focus();};
window.addEventListener('keydown',e=>{if(e.code!=='KeyL'||/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)||$('guide').open)return;e.preventDefault();update('surfaceLock',!A.getState().surfaceLock);A.toast(A.getState().surfaceLock?'Surface level lock on within 1 km.':'Surface level lock off.');});
function sync(){const s=A.getState(),ground=SphereInspection.surface(s);$('consolePlay').textContent=s.playing?'Pause':'Play';$('consolePlay').setAttribute('aria-label',s.playing?'Pause simulation':'Play simulation');$('consoleTime').textContent=$('timeReadout').textContent;
 if(document.activeElement!==$('consoleScrub'))$('consoleScrub').value=s.time;
 $('consoleAttachment').disabled=!/^shade-/.test(s.siteId);$('consoleAttachment').textContent=s.shadeAttachment!==null?'Detach from Shade':'Follow Shade';
 $('consoleFrame').textContent=s.shadeAttachment!==null?'Following Shade '+s.shadeAttachment+' · movement is relative to its surface.':'Free flight · '+(s.surfaceLock&&ground.altitude<=1?'level with '+ground.name:'independent camera');
 $('consoleLevel').checked=s.surfaceLock;$('consoleMaterials').value=s.richMaterials?'1':'0';$('consoleShadows').value=String(s.localShadows);$('consoleAntialias').value=String(s.antialias);
 for(const [id,key]of [['consoleRate','timeRate'],['consoleSpeed','speed'],['consoleFov','fov'],['consoleExposure','exposure']]){const el=$(id),value=String(s[key]);if(el.tagName==='SELECT'&&![...el.options].some(o=>o.value===value)){const option=document.createElement('option');option.value=value;option.textContent=value+' · custom';el.append(option);}if(document.activeElement!==el)el.value=value;}
 $('consoleFovValue').textContent=s.fov+'°';$('consoleExposureValue').textContent=s.exposure.toFixed(1)+' stops';
}
window.addEventListener('sphere-state-synced',sync);window.addEventListener('sphere-telemetry',sync);sync();
})();
