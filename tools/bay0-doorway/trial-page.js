import {mainPose,packPose,lightReceiver} from '/geographic-flight.js';
// Bay 0 doorway trial: the route, its marks and the readings, as one in-page module.
// Loaded the same way by a person in the browser pane and by run-trial.cjs:
//   const t = await import('/tools/bay0-doorway/trial-page.js'); await t.open('hall');
// Marks are station-local: depth is metres inside the City face of Date Line Exchange
// (negative = outside), east is chainage in metres. The Service opening is 4 m x 4 m at east 2600.
export const STATION={name:'Date Line Exchange',route:'service',east:2600,half:24000,door:[4,4]};
export const MARKS={
  hall:   {depth:60,  east:2600, yaw:Math.PI, pitch:.025, note:'distant hall view, opening about 3.8 deg across'},
  inside: {depth:.7,  east:2600, yaw:Math.PI, pitch:.025, note:'one step inside the jamb, opening near full screen'},
  outside:{depth:-.8, east:2600, yaw:Math.PI, pitch:.025, note:'just outside, on the City apron'}
};
// The sidestep at the jamb: 2.4 m from the left jamb toward the right, eye fixed at depth .7.
export const SIDESTEP={depth:.7,from:2598.8,to:2601.2,yaw:Math.PI,pitch:.04,seconds:6};

const frame=()=>document.querySelector('#stageFrame iframe');
const border=()=>SphereBiomeLibrary.locations().find(x=>x.transport&&x.id!=='border-transport');
export const local=m=>({eastM:m.east,northM:-(STATION.half-m.depth),altitudeM:1.7,yaw:m.yaw,pitch:m.pitch,mode:'walk'});
const settle=ms=>new Promise(r=>setTimeout(r,ms));

export function settings(next={}){
  const s=window.SphereDoorwayTrial??=({mode:'current',light:'reference',farM:0,holdBorder:true,cells:{frames:0,built:0,reused:0,drawn:0,resident:0,released:0}});
  Object.assign(s,next);return {mode:s.mode,light:s.light,farM:s.farM,holdBorder:s.holdBorder};
}
export function resetCells(){const c=window.SphereDoorwayTrial?.cells;if(c)Object.assign(c,{frames:0,built:0,reused:0,drawn:0,resident:c.resident,released:0});}

// Open the station at a mark with the clock held. Later marks move the walker in place.
export async function open(mark='hall'){
  const L=SphereBiomeLibrary,T=SphereStageFrame,A=SphereApp,g=await import('/geographic-flight.js'),b=border();
  A.setPlaying(false);
  if(frame()?.dataset.locationId===b.id && frame()?.contentWindow?.SphereBorderTrial){place(mark);await settle(400);return sample();}
  T.close();
  const w=g.mainPose(A.getState(),b,local(MARKS[mark]??mark),SphereAtlas,SphereWorld);
  await T.open(b.id,{entry:{geographic:true,pose:g.packPose({...w,walkMode:true},b,SphereAtlas,SphereWorld,{exactAltitude:true}),horizontalFov:75}});
  for(let i=0;i<100&&!frame()?.contentWindow?.SphereBorderTrial;i++)await settle(100);
  await settle(800);return sample();
}
export async function openCity(mark='inside'){
  const stage=SphereStageFrame, city=SphereBiomeLibrary.entry('sideways-city'), position=local(MARKS[mark]??mark);
  SphereApp.setPlaying(false);stage.close();
  const world=mainPose(SphereApp.getState(),border(),position,SphereAtlas,SphereWorld);
  const pose=packPose({...world,walkMode:true},city,SphereAtlas,SphereWorld,{exactAltitude:true});
  await stage.open(city.id,{entry:{geographic:true,pose,horizontalFov:75}});
}
export function location(){
  const f=frame(),owner=f?.dataset.locationId,api=f?.contentWindow?.SphereBiome;
  if(!api?.pose || !f.surfaceEntry?.active || document.querySelector('#departingStageFrame'))return {owner,settled:false};
  const at=api.pose(),b=border(),stationPose=owner===b.id?at:packPose({...mainPose(SphereApp.getState(),SphereBiomeLibrary.entry(owner),at,SphereAtlas,SphereWorld),walkMode:true},b,SphereAtlas,SphereWorld,{exactAltitude:true});
  return {owner,settled:true,stationPose,depth:stationPose.northM+STATION.half};
}
export function place(mark){frame().contentWindow.SphereBorderTrial.place(local(MARKS[mark]??mark));}

// Sphere time. The host clock is held; direct is the Shade visibility at this pose.
export function setTime(seconds){SphereApp.setPlaying(false);SphereApp.setState({...SphereApp.getState(),time:seconds});}
export function light(){const f=frame();const p=f.contentWindow.SphereBiome.pose();return SphereStageFrame.surfaceLight(f.contentWindow,p);}
// Verify the Shade against the actual destination and world profile. Searching a copied
// state leaves both the camera and the running scene clock untouched.
export function lightSchedule(suggested){
  const state=SphereApp.getState(),receiver=lightReceiver(state,border(),local(MARKS.inside),SphereAtlas,SphereWorld);
  const direct=t=>SphereCollection.visibility(receiver,{...state,time:t},64);
  const profile=Object.fromEntries(['seed','layoutVersion','era','collection','routeShades','shadeShape','shadeTrim',
    'shadeGeometryRevision','shadeFractureRevision','starStation','cycleScale','axisLat','axisLon','shellshine'].map(k=>[k,state[k]]));
  const atSuggested=Object.fromEntries(Object.entries(suggested).map(([k,t])=>[k,direct(t)]));
  let noon=suggested.noon,night=suggested.night;
  if(atSuggested.noon<.999 || atSuggested.dusk<.35 || atSuggested.dusk>.65 || atSuggested.night>.001){
    let lastFull=null;
    for(let t=0;t<=60*86400;t+=1800){
      const d=direct(t);
      if(d>=.999)lastFull=t;
      else if(d<=.001 && lastFull!==null){noon=lastFull;night=t;break;}
    }
    if(direct(noon)<.999 || direct(night)>.001)
      throw Error('No complete Shade crossing for the station in this profile: '+JSON.stringify({profile,atSuggested}));
  }
  const atLevel=level=>{
    let lo=noon,hi=night;
    while(hi-lo>1){const mid=Math.floor((lo+hi)/2);if(direct(mid)>level)lo=mid;else hi=mid;}
    return Math.abs(direct(lo)-level)<Math.abs(direct(hi)-level)?lo:hi;
  };
  const dusk=atSuggested.dusk>=.35&&atSuggested.dusk<=.65&&noon===suggested.noon&&night===suggested.night?suggested.dusk:atLevel(.5);
  const times={noon,dusk,night},sweep=[.9,.7,.5,.3,.1].map(atLevel);
  return {times,sweep,profile,atSuggested,atMarks:Object.fromEntries(Object.entries(times).map(([k,t])=>[k,direct(t)]))};
}

export function sample(){
  const f=frame(),api=f?.contentWindow?.SphereBiome,info=api?.inspect?.()??{},s=SphereApp.getState();
  const readout=document.querySelector('.camera-locator, #cameraLocator')?.innerText??null;
  return {owner:f?.dataset.locationId,pose:api?.pose?.(),station:info.station?.key??info.station??null,address:border()?.id,location:location(),
    viewport:{css:[innerWidth,innerHeight],canvas:(c=>c&&[c.width,c.height])(f?.contentDocument?.querySelector('canvas'))},
    hfov:75,sphereTime:s.time,sceneSeconds:SphereApp.sceneSeconds,light:light(),settings:settings(),
    picture:info.habitatWindow,label:f?.contentDocument?.querySelector('#readout')?.textContent??null,readout,
    gl:f?.contentDocument?.querySelector('canvas')?.getContext('webgl2')?.getError()};
}

// Sidestep across the jamb at walking pace while sampling the picture's cell work.
export async function sidestep({from=SIDESTEP.from,to=SIDESTEP.to,seconds=SIDESTEP.seconds,steps=60}={}){
  const rows=[];resetCells();
  for(let i=0;i<=steps;i++){const east=from+(to-from)*i/steps;place({depth:SIDESTEP.depth,east,yaw:SIDESTEP.yaw,pitch:SIDESTEP.pitch});
    await settle(seconds*1000/steps);const p=sample().picture;rows.push({east:+east.toFixed(3),mode:p?.mode,cells:p?.cells?.last??null,captures:p?.captures,reuses:p?.reuses,bytes:p?.bytes});}
  return {rows,totals:{...window.SphereDoorwayTrial?.cells}};
}

// Frame intervals from requestAnimationFrame in the station page, for a quick reading here.
// run-trial.cjs takes the reported numbers in native Chrome on an idle GPU.
export async function frames(ms=5000){
  const w=frame().contentWindow,out=[];let last=0,stop=false;
  await new Promise(r=>{const tick=t=>{if(last)out.push(t-last);last=t;if(!stop)w.requestAnimationFrame(tick);else r();};w.requestAnimationFrame(tick);setTimeout(()=>{stop=true;},ms);});
  out.sort((a,b)=>a-b);const q=p=>out[Math.min(out.length-1,Math.floor(p*out.length))];
  return {frames:out.length,p50:q(.5),p95:q(.95),max:out.at(-1)};
}
window.bay0Trial={STATION,MARKS,SIDESTEP,open,openCity,location,place,settings,setTime,light,lightSchedule,sample,sidestep,frames};
