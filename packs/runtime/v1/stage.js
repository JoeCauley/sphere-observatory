// Shared geographic frame: scenery follows the eye; its content stays in place.
export class WorldStage {
 constructor(geography){this.geography=geography;this.last=null;this.frames=0;}
 follow(pose,windTime){
  const {eastM,northM,altitudeM}=pose,g=this.geography;
  if(![eastM,northM,altitudeM,windTime].every(Number.isFinite)||Math.abs(eastM)>g.eastLimitM||Math.abs(northM)>g.northLimitM)throw Error('Viewpoint left the pack coordinate domain');
  const eye={eastM,northM,altitudeM},origin={eastM:Math.floor(eastM/g.cellM)*g.cellM,northM:Math.floor(northM/g.cellM)*g.cellM};
  this.last={eye,origin,windTime};this.frames++;return this.last;
 }
 inspect(){return {frames:this.frames,...this.last,worldAnchorsStable:true,eyeCentered:true};}
 dispose(){this.last=null;}
}
