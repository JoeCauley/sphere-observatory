// Bay 0 doorway trial switches, read once from the host page's query and kept on the host
// window so a harness can change them at run time.
//   doorway=current|clipped   force picture card or direct scissored draw; otherwise choose by distance
//   light=reference|sphere    original fixed City light or destinationLight() (default)
//   skyline=<metres>          beyond this distance the clipped trace keeps towers only (0 = full)
export function trialSettings(host){
  if(host.SphereDoorwayTrial)return host.SphereDoorwayTrial;
  const q=new URLSearchParams(host.location.search);
  return host.SphereDoorwayTrial={mode:['current','clipped'].includes(q.get('doorway'))?q.get('doorway'):'auto',light:q.get('light')==='reference'?'reference':'sphere',
    farM:Math.max(0,Number(q.get('skyline'))||0),holdBorder:q.get('hold')==='1',cells:{frames:0,built:0,reused:0,drawn:0,resident:0,released:0}};
}
