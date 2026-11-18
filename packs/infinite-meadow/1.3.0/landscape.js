// Shared support field. The accepted starting place is unchanged inside 96 m.
// Rebasing the phases keeps the hills geographic when the stage follows the eye.
const TAU=Math.PI*2,phase=x=>x%TAU;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function terrainPhases(e,n){return [e*.014+.3,n*.011+.8,n*.035+e*.006,(e+n)*.019].map(phase);}
export function landscapePhases(e,n){return [e*.00173+n*.00091+.57,-e*.00119+n*.00231+2.03,e*.00317-n*.00137+.91,e*.00083+n*.00107-.4].map(phase);}
export function originalTerrain(e,n){return Math.max(.5,12+8*Math.sin(e*.014+.3)*Math.sin(n*.011+.8)+4*Math.sin(n*.035+e*.006)+3*Math.cos((e+n)*.019));}
export function heightFromPhases(old,region,home,at=[0,0]){
 const [x,z]=at,a=old[0]+x*.014,b=old[1]+z*.011,c=old[2]+z*.035+x*.006,d=old[3]+(x+z)*.019;
 const familiar=Math.max(.5,12+8*Math.sin(a)*Math.sin(b)+4*Math.sin(c)+3*Math.cos(d));
 const blend=smooth(96,240,Math.hypot(home[0]+x,home[1]+z));if(blend===0)return familiar;
 const p=region[0]+x*.00173+z*.00091,q=region[1]-x*.00119+z*.00231,r=region[2]+x*.00317-z*.00137,s=region[3]+x*.00083+z*.00107;
 const wx=27*Math.sin(p)+16*Math.sin(r),wz=35*Math.sin(q)-14*Math.cos(r);
 const relief=8*Math.sin(a+wx*.014)*Math.sin(b+wz*.011)+4*Math.sin(c+wz*.035+wx*.006)+3*Math.cos(d+(wx+wz)*.019);
 const plain=smooth(.32,.76,Math.sin(p)*Math.sin(q));
 const amplitude=(.72+.86*(.5+.5*Math.sin(r)))*(1-.96*plain);
 const varied=Math.max(.5,12+amplitude*relief+3.5*Math.sin(s)*(1-.82*plain));
 return familiar+(varied-familiar)*blend;
}
export function terrain(e,n){return heightFromPhases(terrainPhases(e,n),landscapePhases(e,n),[e,n]);}
export const TERRAIN_GLSL=`
uniform vec4 uTerrainPhase,uLandscapePhase;uniform vec2 uHomeOffset;
float coverGround(vec2 at){
 float a=uTerrainPhase.x+at.x*.014,b=uTerrainPhase.y+at.y*.011;
 float c=uTerrainPhase.z+at.y*.035+at.x*.006,d=uTerrainPhase.w+(at.x+at.y)*.019;
 float familiar=max(.5,12.+8.*sin(a)*sin(b)+4.*sin(c)+3.*cos(d));
 float blend=smoothstep(96.,240.,length(at+uHomeOffset));if(blend==0.)return familiar;
 float p=uLandscapePhase.x+dot(at,vec2(.00173,.00091)),q=uLandscapePhase.y+dot(at,vec2(-.00119,.00231));
 float r=uLandscapePhase.z+dot(at,vec2(.00317,-.00137)),s=uLandscapePhase.w+dot(at,vec2(.00083,.00107));
 float wx=27.*sin(p)+16.*sin(r),wz=35.*sin(q)-14.*cos(r);
 float relief=8.*sin(a+wx*.014)*sin(b+wz*.011)+4.*sin(c+wz*.035+wx*.006)+3.*cos(d+(wx+wz)*.019);
 float plain=smoothstep(.32,.76,sin(p)*sin(q));
 float amplitude=(.72+.86*(.5+.5*sin(r)))*(1.-.96*plain);
 return mix(familiar,max(.5,12.+amplitude*relief+3.5*sin(s)*(1.-.82*plain)),blend);
}
`;
