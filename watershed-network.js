/* Version-one catchment graph shared by the atlas study and live province. */
(function(root){
'use strict';
function noise(x,y,seed=1){const hash=(x,y)=>{let h=Math.imul(x^seed,374761393)^Math.imul(y,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b,s=u*u*(3-2*u),t=v*v*(3-2*v);return (hash(a,b)*(1-s)+hash(a+1,b)*s)*(1-t)+(hash(a,b+1)*(1-s)+hash(a+1,b+1)*s)*t;}
function terrain(u,v,seed){return .55*(1-u)+.15+.16*Math.sin(v*9+u*4)+.28*noise(u*4,v*4,seed)+.13*noise(u*11,v*11,seed+3)+.035*noise(u*31,v*31,seed+9);}
class Heap{
 constructor(){this.a=[];}
 push(item){const a=this.a;let i=a.length;a.push(item);while(i){const p=(i-1)>>1;if(a[p][0]<=item[0])break;a[i]=a[p];i=p;}a[i]=item;}
 pop(){const a=this.a,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1][0]<a[j][0])j++;if(a[j][0]>=last[0])break;a[i]=a[j];i=j;}a[i]=last;}return first;}
}
function province(seed=713,n=192){
 const height=new Float64Array(n*n),filled=new Float64Array(n*n),parent=new Int32Array(n*n).fill(-1),flow=new Float64Array(n*n).fill(1),visited=new Uint8Array(n*n),order=[],heap=new Heap();
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)height[y*n+x]=terrain(x/(n-1),y/(n-1),seed);
 // Priority flooding gives every inland cell a downstream route to a boundary.
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(!x||!y||x===n-1||y===n-1){const i=y*n+x;visited[i]=1;filled[i]=height[i];heap.push([filled[i],i]);}
 while(heap.a.length){const [level,i]=heap.pop(),x=i%n,y=Math.floor(i/n);order.push(i);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=n||yy>=n)continue;const j=yy*n+xx;if(visited[j])continue;visited[j]=1;parent[j]=i;filled[j]=Math.max(height[j],level+1e-7);heap.push([filled[j],j]);}}
 for(let j=order.length-1;j>=0;j--){const i=order[j];if(parent[i]>=0)flow[parent[i]]+=flow[i];}
 const rivers=[];for(let i=0;i<parent.length;i++)if(parent[i]>=0&&flow[i]>60){const j=parent[i];rivers.push({a:[i%n/(n-1),Math.floor(i/n)/(n-1)],b:[j%n/(n-1),Math.floor(j/n)/(n-1)],flow:flow[i]});}
 // Service sites sit on dry banks next to significant water routes.
 const riverIds=new Set();for(let i=0;i<parent.length;i++)if(parent[i]>=0&&flow[i]>60)riverIds.add(i);
 const incoming=new Uint8Array(n*n);for(const i of riverIds)incoming[parent[i]]++;
 const riverPaths=[];for(const i of riverIds)if(incoming[i]!==1){let j=i;const points=[];let maxFlow=flow[i];while(true){points.push([j%n/(n-1),Math.floor(j/n)/(n-1)]);const next=parent[j];if(next<0)break;j=next;maxFlow=Math.max(maxFlow,flow[j]);if(!riverIds.has(j)||incoming[j]!==1){points.push([j%n/(n-1),Math.floor(j/n)/(n-1)]);break;}}if(points.length>1)riverPaths.push({points,flow:maxFlow});}
 const sites=[];for(const r of [...rivers].sort((a,b)=>b.flow-a.flow)){const [u,v]=r.a;if(u<.14||u>.88||v<.12||v>.88||sites.some(p=>Math.hypot(p.u-u,p.v-v)<.15))continue;sites.push({u:Math.min(.94,u+.018),v,role:['Water recovery','Reserve storage','Fabrication','Thermal transfer'][sites.length%4]});if(sites.length===9)break;}
 return {seed,n,height,filled,parent,flow,rivers,riverPaths,sites,extentKm:640,focus:sites.find(p=>p.u>.25&&p.u<.75&&p.v>.28&&p.v<.72)||{u:.68,v:.6}};
}
root.SphereWatershedNetwork={noise,province};
})(typeof window==='undefined'?globalThis:window);
