// Advances once from the Observatory frame, including time spent in other biomes.
(function(){
  let current=null,key=null,loading=null;
  function select(world) {
    if(world===key && loading)return loading;
    current?.close();current=null;key=world;
    if(!world){loading=null;return Promise.resolve(null);}
    loading=import('./packs/kit/mill-clock.mjs').then(async({MillClock,httpJournal})=>{
      const clock=new MillClock(httpJournal(world),localStorage,'sphere-mill-pending:'+world);
      await clock.open();
      if(key===world)current=clock;
      return clock;
    });
    return loading;
  }
  function followWorld(){
    const lib=window.SphereBiomeLibrary;
    const world=lib?.installed?.().some?.(item=>item.packId==='infinite-industry')?lib.world?.key:null;
    if(world!==key)select(world);
  }
  window.SphereProduction={
    select,
    advance(seconds,playing){current?.step(seconds,playing);},
    get current(){return current;}
  };
  window.addEventListener('sphere-biomes-changed',followWorld);
  window.addEventListener('sphere-biome-world-leaving',()=>select(null));
  window.addEventListener('pagehide',()=>current?.close());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)current?.close();});
})();
