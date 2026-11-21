import assert from 'node:assert/strict';
import {addressOf,classes,generateStation} from '../packs/border-transport/0.10.0/station.mjs';
import {districtFor} from '../packs/border-transport/0.10.0/survey.mjs';
import {districtPoint,districtLocation,outsideDistrict,hallHalfM,linkHalfM,nearestSite,rightSign} from '../packs/border-transport/0.10.0/district.mjs';
import {boardingPose,move} from '../packs/border-transport/0.10.0/motion.mjs';
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
      assert.equal(move(s,d,offset,c,0,18,0,0,0).blocked,'Clearance limit');
      const tooLarge={...boardingPose(s,classes[1]),eastM:p.eastM};
      assert.equal(move(s,d,tooLarge,classes[1],0,60,0,0,0).blocked,'Clearance limit');
      const roof=s.roofM+45+c.eye;
      const top={...p,northM:0,altitudeM:roof+150,mode:'flight'};
      assert.equal(move(s,d,top,c,0,0,-300,0,0).pose.altitudeM,roof);
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
assert.equal(layouts.size,3);
console.log(JSON.stringify({walks,longitudinal,layouts:layouts.size,projections}));
