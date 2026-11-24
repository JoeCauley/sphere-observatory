import assert from 'node:assert/strict';
import {addressOf,classes,generateStation} from '../packs/border-transport/0.10.0/station.mjs';
import {districtFor} from '../packs/border-transport/0.10.0/survey.mjs';
import {districtPoint,districtLocation,outsideDistrict,hallHalfM,linkHalfM,nearestSite,rightSign} from '../packs/border-transport/0.10.0/district.mjs';
import {borderEnvironment} from '../packs/border-transport/0.10.0/environment.mjs';
import {roofSlabM} from '../packs/border-transport/0.10.0/district.mjs';
import {boardingPose,move,constrainExterior,walker} from '../packs/border-transport/0.10.0/motion.mjs';
import {outsideStationScene,serviceGalleryDepthM} from '../packs/border-transport/0.10.0/district.mjs';
import {bayStart,portals,quayZ} from '../packs/border-transport/0.10.0/freight-bay.mjs';
import {plantPatch,growWallPlants} from '../packs/border-transport/0.10.0/wall-plants.mjs';
import {stationMesh} from '../packs/border-transport/0.10.0/view.mjs';
const world='sphere-0000000000000017',radius=149597870700;
const layouts=new Set();let walks=0,projections=0,longitudinal=0;
for(const edge of [['r10c0','r11c0'],['r12c0','r12c1'],['r12c0','r12c'+(globalThis.SphereAtlas.columns(12)-1)]]){
  for(const r of [radius,2.4e7]){
    const d=districtFor(world,...edge,r);
    assert.deepEqual(d,districtFor(world,edge[1],edge[0],r));
    for(const s of d.sites)for(const [x,z] of [[s.x+13580,15600],[s.x-409,-33000],[s.x,0]]){
      const ll=districtLocation(d,x,z),p=districtPoint(d,ll.latitude,ll.longitude);
      assert(Math.hypot(x-p.eastM,z-p.northM)<.0001);projections++;
    }
    assert.equal(rightSign(d),d.origin.axis==='parallel'?-1:d.origin.acrossSign);
    for(const direction of [-1,1]){
      const from=d.sites[direction===1?0:d.sites.length-1],to=d.sites[direction===1?d.sites.length-1:0];
      let p={eastM:from.x-direction*hallHalfM,northM:720,altitudeM:1.7,yaw:direction*Math.PI/2,pitch:0,mode:'walk'};
      const visited=new Set(),end=to.x+direction*hallHalfM,stations=new Map(d.sites.map(site=>[site,generateStation(site.address)]));
      while(Math.abs(end-p.eastM)>.01){
        const site=nearestSite(d,p.eastM);visited.add(site.bay);
        const step=direction*Math.min(4000,Math.abs(end-p.eastM)),out=move(stations.get(site),d,p,classes[0],step,0,0,1234,0);
        assert.equal(out.blocked,'');assert.equal(out.pose.mode,'walk');assert.equal(out.pose.altitudeM,1.7);p=out.pose;
      }
      assert.equal(visited.size,d.sites.length);longitudinal++;
    }
    for(const site of d.sites){
      const hall=generateStation(site.address);
      const eye=[220,12,hall.widthM+8],near=plantPatch(hall,d,eye,[1,2]);
      assert(near && !plantPatch(hall,d,eye,[2,1]) && !plantPatch(hall,d,[220,12,hall.widthM+120],[1,2]));
      const leaves=patch=>{
        const rows=[];growWallPlants({quad:(...p)=>rows.push(p)},hall,d,patch);return rows;
      };
      const foliage=leaves(near);
      assert(foliage.length>0 && foliage.length<4500);
      const overlap=faces=>faces.filter(([root])=>root[0]>215 && root[0]<230);
      const adjacent=plantPatch(hall,d,[eye[0]+24,eye[1],eye[2]],[1,2]);
      assert.deepEqual(overlap(foliage),overlap(leaves(adjacent)),'Shared cells must retain the same stems and leaves while strafing');
      const zone=(x,z,y)=>borderEnvironment(d,hall,{eastM:site.x+x,northM:z,altitudeM:y});
      for(const side of [-1,1]){
        const plot=site.address.plots[side<0?0:1];
        assert.deepEqual(zone(0,side*(hall.widthM/2+1),1.7),{zone:'biome',air:plot,blind:plot});
        assert.equal(zone(0,side*(hall.widthM/2-1),1.7).air,'station');
      }
      assert.equal(zone(0,0,hall.roofM+roofSlabM).air,'vacuum');
      assert.equal(zone(bayStart+1,0,1.7).zone,'freight well');
      assert.equal(zone(bayStart,0,1.7).zone,'interior');
      assert.equal(zone(hallHalfM+1,linkHalfM+1,1.7).zone,'biome');
      if(site===d.sites.at(-1))assert.equal(zone(hallHalfM+1,0,1.7).zone,'biome');
      const s=generateStation(site.address);layouts.add(s.layout);
      assert.equal(s.widthM,site.widthM);assert.equal(s.address.radiusM,r);
      for(const c of classes)for(const far of [false,true]){
        const sign=far?-1:1,start=boardingPose(s,c,far);
        let p=start;const target=-start.northM;
        // Place the timetable in an open interval; step the real production collision solver.
        const clock=(s.address.chainageM+start.eastM-site.x+8500)/s.traffic.speedMps-s.traffic.phaseS;
        for(let steps=0;sign*(target-p.northM)>.001;steps++){
          const dz=sign*Math.min(1800,Math.abs(target-p.northM));
          const moved=move(s,d,p,c,0,dz,0,clock,0);
          assert(!moved.blocked,[edge,site.bay,s.layout,c.id,far,moved.blocked,moved.pose.northM].join('/'));
          p=moved.pose;assert(steps<80);
        }
        assert(Math.abs(p.altitudeM-c.eye)<.05);walks++;
      }
      const c=classes[0],p=boardingPose(s,c),offset={...p,eastM:p.eastM+50};
      for(const end of [-1,1]){
        const approach={...p,eastM:site.x+end*(hallHalfM-12),northM:linkHalfM+45};
        assert.equal(move(s,d,approach,c,end*24,0,0,0,0).blocked,'Clearance limit');
        assert.equal(move(s,d,{...approach,northM:linkHalfM-45},c,end*24,0,0,0,0).blocked,'');
      }
      for(const face of [-1,1]){
        const serviceX=site.x+s.routes[0].nearDoor[0],faceZ=face*s.widthM/2;
        const distance=(depth,height=1.7)=>outsideStationScene(d,serviceX,faceZ-face*depth,height);
        assert(distance(-2)>0 && distance(2)>0 && distance(serviceGalleryDepthM+1)<0);
        for(const depth of [-12,-2,-.25,0,.25,2,30])
          assert.equal(distance(depth),serviceGalleryDepthM-depth,'Approaching the inner threshold is monotone across the outer jamb');
        assert(distance(2,s.roofM+46)<0,'The roof has its own handoff at the facade');
        for(const route of s.routes){
          const x=site.x+route.nearDoor[0]+route.door[0]*.35;
          const threshold=(depth,height)=>outsideStationScene(d,x,faceZ-face*depth,height);
          assert(threshold(2,route.door[1]*.5)>0);
          assert(threshold(serviceGalleryDepthM+1,route.door[1]*.5)<0);
          assert(threshold(2,route.door[1]+8)<0);
        }
        const start={eastM:serviceX,northM:faceZ+face*10,altitudeM:1.7};
        const inside={...start,northM:faceZ-face*37};
        assert.equal(constrainExterior(s,d,start,inside),inside,'The service opening admits a walker from either biome');
        const ordinaryX=site.x===d.sites.at(-1).x?site.x-80000:site.x+80000;
        const distant={eastM:ordinaryX,northM:face*(linkHalfM+4500),altitudeM:17};
        const diagonal={...distant,eastM:ordinaryX+30,northM:face*(linkHalfM-200)};
        const stopped=constrainExterior(s,d,distant,diagonal);
        assert(Math.abs(stopped.northM)>linkHalfM && Math.abs(stopped.northM)<linkHalfM+3);
        assert.equal(stopped.eastM,diagonal.eastM,'A blocked diagonal retains its travel along the wall');
        const parallel={...stopped,eastM:stopped.eastM+200};
        assert.equal(constrainExterior(s,d,stopped,parallel),parallel);
        const contact={...stopped,northM:face*(linkHalfM+1+walker.body[2]/2-.000025)};
        for(const motion of [{eastM:contact.eastM-25},{altitudeM:contact.altitudeM+7},{northM:contact.northM+face*12}]){
          const to={...contact,...motion};
          assert.equal(constrainExterior(s,d,contact,to),to,'Chart roundoff cannot pin a walker to a wall');
        }
        // A shallow diagonal can finish against either the concrete face or a projecting rib.
        for(const x of [site.x-12600,site.x-12596]){
          const from={eastM:x,northM:faceZ+face*8,altitudeM:1.7};
          const stopped=constrainExterior(s,d,from,{...from,northM:faceZ-face*5});
          const touching={...stopped,northM:stopped.northM-face*.000025};
          for(const to of [{...touching,altitudeM:touching.altitudeM+3},{...touching,northM:touching.northM+face*5}])
            assert.equal(constrainExterior(s,d,touching,to),to,'The walker can lift or back away from the actual cladding');
        }
        const outside={...p,eastM:site.x-12600,northM:face*(s.widthM/2+5)};
        const panel={...outside,eastM:outside.eastM+4};
        assert.equal(move(s,d,outside,c,0,-face*.85,0,0,0).blocked,'Clearance limit','The projecting Outfall rib blocks the walker');
        assert.equal(move(s,d,panel,c,0,-face*.85,0,0,0).blocked,'','The panel lips sit behind the ribs');
        const gallery={...p,northM:face*(s.widthM/2-21)};
        const clear=move(s,d,gallery,c,face*2,0,0,0,0);
        assert.equal(clear.blocked,'');
        assert.equal(move(s,d,clear.pose,c,face*1.5,0,0,0,0).blocked,'Clearance limit','The low gallery pipe has the same handedness as the picture');
      }
      assert.equal(move(s,d,offset,c,0,18,0,0,0).blocked,'Clearance limit');
      const tooLarge={...boardingPose(s,classes[1]),eastM:p.eastM};
      assert.equal(move(s,d,tooLarge,classes[1],0,60,0,0,0).blocked,'Clearance limit');
      const roof=s.roofM+45+c.eye;
      const top={...p,northM:0,altitudeM:roof+150,mode:'flight'};
      assert.equal(move(s,d,top,c,0,0,-300,0,0).pose.altitudeM,roof);
      const quay={...top,eastM:site.x+7010,northM:quayZ-40,altitudeM:4000};
      const landing=move(s,d,quay,c,0,0,-5000,0,0);
      assert.equal(landing.blocked,'');assert.equal(landing.pose.altitudeM,c.eye);
      const walk=move(s,d,{...landing.pose,mode:'walk'},c,160,0,0,0,0);
      assert.equal(walk.blocked,'');assert.equal(walk.pose.altitudeM,c.eye);
      const openRoof={...quay,eastM:site.x+bayStart-8,mode:'walk',altitudeM:roof};
      assert.equal(move(s,d,openRoof,c,24,0,0,0,0).pose.mode,'flight');
      const besidePier={...walk.pose,eastM:site.x+portals[1]-170,northM:-1150};
      assert.equal(move(s,d,besidePier,c,400,0,0,0,0).blocked,'Clearance limit');
      const girder={...quay,eastM:site.x+portals[1]-84,northM:0};
      const hit=move(s,d,girder,c,0,0,-1800,0,0);
      assert.equal(hit.blocked,'Clearance limit');assert(hit.pose.altitudeM>s.roofM+1000);
      const inside={...p,northM:9000,eastM:site.x+7000,altitudeM:1500,mode:'flight'};
      assert(move(s,d,inside,c,0,0,600,0,0).pose.altitudeM<s.roofM);
    }
    assert(outsideDistrict(d,90000,linkHalfM-1)<0);assert(outsideDistrict(d,90000,linkHalfM+2)>0);
    assert(outsideDistrict(d,d.sites.at(-1).x+hallHalfM+2,0)>0);
  }
}
const short=districtFor(world,'r12c0','r12c1',1e6);
assert.deepEqual(short.sites.map(s=>s.bay),[0]);
assert(outsideDistrict(short,200000,0)>0);
const widelySpaced={sites:[{x:-2300000},{x:0},{x:1260000},{x:4920000}]};
for(const [x,winner] of [[-10000000,0],[-1000000,1],[600000,1],[630000,2],[3000000,2],[3700000,3]])
  assert.equal(nearestSite(widelySpaced,x),widelySpaced.sites[winner]);
const local=districtFor(world,'r12c0','r12c1',radius);
const center=generateStation(local.sites[1].address);
const distant=Array.from({length:2048},(_,i)=>({x:local.sites[2].x+(i+1)*1000000}));
assert.equal(stationMesh(center,{...local,sites:[...local.sites,...distant]},true).length,
  stationMesh(center,local,true).length,'Distant stations and reaches cost no render geometry');
assert.equal(layouts.size,3);
console.log(JSON.stringify({walks,longitudinal,layouts:layouts.size,projections}));
