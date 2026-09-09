/* Screen selections are integrated over the actual curved shell, in km². */
(function(root){
 const M=root.SphereMath,EARTH=4*Math.PI*6371**2;
 function inside(x,y,p){let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
 function density(x,y,s,aspect){const b=M.basis(s.forward,s.up),d=M.ray(x,y,aspect,s.fov,b,s.projection==='panorama'),t=M.shellDistance(s.position,d,s.radius),q=M.add(s.position,M.mul(d,t)),cosine=Math.abs(M.dot(M.norm(q),d));let omega;
  if(s.projection==='panorama')omega=Math.PI*Math.PI*.5*Math.max(0,Math.cos(y*Math.PI/2));
  else{const k=Math.tan(M.radians(s.fov)/2);omega=k*k/aspect/Math.pow(1+(x*k)**2+(y*k/aspect)**2,1.5);}
  return {area:t*t/Math.max(1e-15,cosine)*omega,visible:M.trace(s.position,d,s).kind==='Inner surface'};
 }
 function integrate(s,aspect,polygon,resolution=96){
  if(polygon.length<3)return {area:0,gross:0,samples:0,earths:0};
  const x0=Math.max(-1,Math.min(...polygon.map(p=>p[0]))),x1=Math.min(1,Math.max(...polygon.map(p=>p[0]))),y0=Math.max(-1,Math.min(...polygon.map(p=>p[1]))),y1=Math.min(1,Math.max(...polygon.map(p=>p[1])));
  if(x1<=x0||y1<=y0)return {area:0,gross:0,samples:0,earths:0};
  const nx=resolution,ny=Math.min(256,Math.max(12,Math.round(resolution*(y1-y0)/(x1-x0)))),dy=(y1-y0)/ny,dx=(x1-x0)/nx;let area=0,gross=0,samples=0;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x=x0+(i+.5)*dx,y=y0+(j+.5)*dy;if(!inside(x,y,polygon))continue;const a=density(x,y,s,aspect);gross+=a.area;if(a.visible)area+=a.area;samples++;}
  area*=dx*dy;gross*=dx*dy;return {area,gross,samples,earths:area/EARTH};
 }
 function measure(s,aspect,polygon){const coarse=integrate(s,aspect,polygon,64),fine=integrate(s,aspect,polygon,128);return {...fine,relativeDifference:Math.abs(fine.area-coarse.area)/Math.max(fine.area,1),earthSurfaceKm2:EARTH,method:'Screen-ray area Jacobian, midpoint quadrature; visible shell only',polygon,aspect,state:s};}
 const api={EARTH,inside,density,integrate,measure};root.SphereSurvey=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
