import {hallHalfM,nearestSiteIndex} from './packs/border-transport/0.10.0/district.mjs';

// Intersect the measured horizontal track with the four edges of a surveyed hall.
// The time parameter is in seconds because the velocity is in metres per second.
function arrivalTime(x,z,vx,vz,halfZ){
  let enter=0,leave=Infinity;
  for(const [position,velocity,half] of [[x,vx,hallHalfM],[z,vz,halfZ]]){
    if(Math.abs(velocity)<1e-8){
      if(Math.abs(position)>half)return null;
      continue;
    }
    const a=(-half-position)/velocity,b=(half-position)/velocity;
    enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));
    if(leave<enter)return null;
  }
  return enter;
}

export function freightCourse(district,point,previous,seconds){
  const sites=district.sites,first=sites[0],last=sites.at(-1);
  const x=point.eastM,z=point.northM,index=nearestSiteIndex(district,x),near=sites[index];
  const inside=Math.abs(x-near.x)<=hallHalfM && Math.abs(z)<=near.widthM/2;
  const terminal=inside && (near===first || near===last)?near:x<first.x-hallHalfM?first:x>last.x+hallHalfM?last:null;
  const result={current:inside?near:null,terminal,next:null,speedMps:0};
  if(!previous || !(seconds>0) || seconds>2)return result;
  const vx=(x-previous.eastM)/seconds,vz=(z-previous.northM)/seconds;
  const speed=Math.hypot(vx,vz);
  // Projecting a stationary pose through the one-AU map introduces submillimetre noise.
  if(speed<.01)return result;
  result.speedMps=speed;
  const step=vx<0?-1:1;
  for(let i=index;i>=0 && i<sites.length;i+=step){
    const site=sites[i];
    if(site!==result.current){
      const t=arrivalTime(x-site.x,z,vx,vz,site.widthM/2);
      if(t!==null)return {...result,next:site,distanceM:speed*t,seconds:t};
    }
    if(Math.abs(vx)<1e-8)break;
  }
  return result;
}

const bay=site=>'bay '+(site.bay>0?'+':'')+site.bay;
export function freightReadout(district,course){
  const {next,terminal,current,speedMps}=course;
  let text;
  if(next){
    const distance=course.distanceM<1000?Math.round(course.distanceM)+' m':(course.distanceM/1000).toFixed(2)+' km';
    const seconds=Math.ceil(course.seconds),eta=seconds<60?seconds+' s':seconds<3600?Math.floor(seconds/60)+' min '+seconds%60+' s':(seconds/3600).toFixed(1)+' h';
    text='Freight '+bay(next)+' · '+distance+' to frontage · '+eta+' at '+Number(speedMps.toFixed(1)).toLocaleString()+' m/s ground speed.';
  }else{
    text=current?'Within freight '+bay(current)+' footprint. ':'';
    text+=speedMps?'No surveyed frontage ahead.':'Ground track stationary.';
  }
  if(terminal && district.sites.length>1){
    const positive=terminal===district.sites[0];
    const direction=district.origin.axis==='parallel'?(positive?'east':'west'):(positive?'north':'south');
    text+=' From terminal '+bay(terminal)+', the surveyed line continues '+direction+'.';
  }
  return text;
}
