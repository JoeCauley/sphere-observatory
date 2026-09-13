/* One explicit travel history, independent of play/pause and pointer state. */
(function(){
'use strict';const A=SphereApp,entries=[];let restoring=false;
function remember(state=A.getState(),title=document.getElementById('viewTitle').textContent){
 if(restoring)return;window.SphereEnhancements?.closeMeasurement();const previous=entries.at(-1);
 if(previous&&['position','forward','up'].every(k=>JSON.stringify(previous.state[k])===JSON.stringify(state[k]))&&previous.state.siteId===state.siteId)return;
 entries.push({state:structuredClone(state),title});if(entries.length>24)entries.shift();sync();
}
function sync(){window.dispatchEvent(new Event('sphere-history-changed'));}
function visit(state,title){remember();SphereTravel.reset();A.setState(state);document.getElementById('viewTitle').textContent=title;window.dispatchEvent(new Event('sphere-view-changed'));document.getElementById('viewport').focus({preventScroll:true});}
function back(){window.SphereEnhancements?.closeMeasurement();const previous=entries.pop();if(!previous)return;restoring=true;try{const current=A.getState();SphereTravel.reset();A.setState({...previous.state,autoSpeed:current.autoSpeed,speed:current.speed});document.getElementById('viewTitle').textContent=previous.title;window.dispatchEvent(new Event('sphere-view-changed'));document.getElementById('viewport').focus({preventScroll:true});}finally{restoring=false;sync();}}
window.SphereJourney={remember,visit,back,get count(){return entries.length;},get previousTitle(){return entries.at(-1)?.title||'';}};
})();
