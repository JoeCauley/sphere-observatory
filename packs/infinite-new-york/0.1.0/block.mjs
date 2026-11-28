import {meshBuilder} from './mesh.mjs';
import {origin} from './address.mjs';

export const eyeHeight=1.67, bodyRadius=.24;
const chalk='#ded7bf', cream='#e7d8b5', metal='#555d56', frame='#605c51', green='#375c52';

export function buildBlock() {
  const mesh=meshBuilder(),{box,rod,quad,sign}=mesh;
  const solid=(...a)=>box(...a,'solid'),floor=(...a)=>box(...a,'floor');
  // A visible slab supplies each walk height, including the landing and the three risers.
  floor(-190,-.3,-160,190,0,160,'road','#b6b5ad');
  for(const [x0,z0,x1,z1] of [[-25,-18.4,23,5.8],[-58,13.8,61,36],[-66,-40,-33,6],[31,-39,67,6],[-26,-45,24,-26]])
    floor(x0,0,z0,x1,.12,z1,'slab','#e2dbcd');
  for(let x=-26;x<33;x+=4.4)
    if(x<-24||x>21)box(x,.002,6.25,x+.72,.012,13.25,'plain','#d9d1b9');
  // The front masonry is built around two actual openings. The same wall pieces stop the walker.
  const Y=origin.y;
  const front=(lo,hi,bottom,top)=>{solid(lo,bottom,-.26,hi,top,0,'brick','#ead5bd');
    box(lo,bottom,-.275,hi,top,-.262,'plaster','#f4ead5');};
  front(-4.24,-2.29,Y,3.92);front(-.81,.77,Y,3.92);front(3.66,4.24,Y,3.92);
  front(-2.29,-.81,2.99,3.92);front(.77,3.66,Y,1.46);front(.77,3.66,3.18,3.92);
  solid(-4.30,.12,-7.23,-4,3.95,-.26,'plaster','#e3ddc9');
  solid(4,.12,-7.23,4.30,3.95,-.26,'plaster','#ede1cb');
  solid(-4.3,.12,-7.3,4.3,3.95,-7,'plaster','#f1ddc4');
  floor(-4.25,.12,-7.25,4.25,Y,0,'wood','#f5e2bf');
  solid(-4.3,3.91,-7.3,4.3,4.08,0,'plaster','#f6ead5');
  for(const [z,max] of [[1.82,.30],[1.47,.48],[1.12,.66]])floor(-2.66,.12,0,-.45,max,z,'stone','#d9c6aa');
  for(const x of [-2.67,-.45]){
    for(const z of [.13,.48,.90,1.28,1.69]){
      const y=z>1.47?.30:z>1.12?.48:.66,top=1.52-.40*Math.max(0,z-.9);
      rod([x,y,z],[x,top,z],.025,.025,'iron',metal,7);
    }
    rod([x,1.55,.06],[x,1.55,.87],.035,.035,'iron',metal);
    rod([x,1.55,.87],[x,1.17,1.84],.035,.035,'iron',metal);
    solid(x-.026,.78,.03,x+.026,.82,1.80,'iron',metal);
  }
  // Open door, casing, transom and engraved address. The leaf is hinged against the inside wall.
  for(const x of [-2.30,-.81])box(x-.08,Y,-.31,x+.08,3.07,.09,'oak','#685541');
  box(-2.43,2.99,-.3,-.69,3.15,.12,'stone','#dec6a0');
  solid(-2.27,Y,-1.49,-2.19,2.93,-.21,'oak',green);
  for(const z of [-1.25,-.77,-.40])box(-2.188,.95,z-.12,-2.167,2.62,z+.12,'oak','#667b66');
  rod([-2.18,1.71,-1.30],[-2.07,1.71,-1.30],.045,.055,'plain','#caa46f');
  box(-2.04,3.12,.015,-1.06,3.53,.11,'oak','#5a4937');sign(-1.55,3.325,.116,.91,.35,'unit');
  box(-3.75,1.48,.015,-2.79,2.67,.10,'iron','#8e7856');sign(-3.27,2.075,.105,.89,1.11,'address');
  for(const x of [.76,2.21,3.65])box(x-.055,1.43,-.31,x+.055,3.22,.07,'oak',chalk);
  for(const y of [1.45,2.47,3.18])box(.69,y-.041,-.33,3.74,y+.041,.08,'oak',chalk);
  box(.57,1.34,-.47,3.84,1.47,.22,'stone',cream);
  box(.55,3.18,-.29,3.86,3.34,.16,'stone',cream);
  // Plinth and the floorboards extend to the opening without a second street scene.
  for(const [lo,hi] of [[-4.3,-2.67],[-.45,4.3]])box(lo,.12,-.22,hi,Y,.06,'stone','#ae9781');
  const trim='#688073';
  box(-3.998,Y,-6.99,-3.93,1.49,-.28,'oak',trim);
  box(3.93,Y,-6.99,3.998,1.49,-.28,'oak',trim);
  box(-4,Y,-7,4,1.49,-6.92,'oak',trim);
  for(const z of [-6.9,-5.9,-4.9,-3.9,-2.9,-1.9,-.9])
    for(const x of [-3.91,3.91])box(x-.031,Y,z-.027,x+.031,1.48,z+.027,'oak','#9a9e83');
  for(const y of [.71,1.50,3.81]){
    const mat=y>3?'#dfd6ba':'#9b9f88';
    for(const x of [-3.93,3.93])box(x-.055,y-.035,-7,x+.055,y+.035,-.28,'oak',mat);
    box(-3.98,y-.035,-6.95,3.98,y+.035,-6.87,'oak',mat);
  }
  // Small dining table, rug, cup and unfolded newspaper.
  const tx=.83,tz=-3.5;
  solid(tx-.60,Y+.71,tz-.57,tx+.60,Y+.78,tz+.57,'oak','#ad8866');
  box(tx-.51,Y+.60,tz-.48,tx+.51,Y+.72,tz+.48,'oak','#916444');
  for(const x of [tx-.46,tx+.46])for(const z of [tz-.42,tz+.42])
    rod([x,Y,z],[x,Y+.71,z],.039,.06,'oak','#966843',8);
  quad([-1.36,Y+.006,-2.23],[1.94,Y+.006,-2.23],[1.94,Y+.006,-4.74],[-1.36,Y+.006,-4.74],[0,1,0],'rug','#e4cfaf',true);
  box(.81,Y+.782,-3.64,1.21,Y+.795,-3.37,'plain','#e6dfce');
  for(let j=0;j<5;j++)for(const x of [.84,1.01])box(x,Y+.796,-3.41-j*.039,x+.13,Y+.797,-3.416-j*.039,'plain','#8a8170');
  rod([.56,Y+.782,-3.28],[.56,Y+.90,-3.28],.047,.058,'plain','#b4cdc0');
  rod([.56,Y+.901,-3.28],[.56,Y+.903,-3.28],.042,.042,'plain','#413528');

  // Cast-iron radiator, a framed print, books and a reading lamp break up the walls.
  for(let i=0;i<14;i++)box(1.0+i*.12,Y+.14,-.58,1.08+i*.12,1.30,-.35,'iron','#a6a695');
  rod([1.01,.84,-.45],[2.66,.84,-.45],.045,.045,'iron','#998f79');
  box(-.15,1.67,-6.91,1.31,3.08,-6.79,'oak','#6d513c');sign(.58,2.375,-6.78,1.31,1.27,'print');
  solid(-3.48,Y,-6.88,-1.63,2.26,-6.44,'oak','#866444');
  for(const y of [1.0,1.51,2.02]){
    box(-3.4,y,-6.44,-1.70,y+.043,-6.38,'oak','#ca9d6a');
    for(let i=0;i<11;i++){const x=-3.36+i*.14,h=.19+((i*13+Math.round(y*10))%7)*.033;
      box(x,y+.044,-6.47,x+.06+(i%3)*.02,y+h,-6.36,'plain',['#627b75','#b48563','#b8a276','#78554b','#777c83'][i%5]);}
  }
  rod([3.28,Y,-5.84],[3.28,Y+.09,-5.84],.23,.2,'iron','#8c8166');
  rod([3.28,Y+.09,-5.84],[3.28,2.37,-5.84],.024,.024,'iron','#c3a979');
  rod([3.28,1.95,-5.84],[3.28,2.43,-5.84],.33,.18,'plain','#efd6a0',16);
  rod([-1,3.43,-4.6],[-1,3.89,-4.6],.013,.013,'iron',frame);
  rod([-1,3.18,-4.6],[-1,3.46,-4.6],.35,.063,'plain','#d9c7a3',18);

  function windowBay(x,y,z,dir,w=1.16,h=1.58,blind=false){
    const layer=(from,to)=>[Math.min(z+dir*from,z+dir*to),Math.max(z+dir*from,z+dir*to)];
    function band(x0,y0,x1,y1,from,to,mat,tint){const [lo,hi]=layer(from,to);box(x0,y0,lo,x1,y1,hi,mat,tint);}
    band(x-w/2-.09,y-.08,x+w/2+.09,y+h+.1,.012,.07,'stone','#c5b59b');
    band(x-w/2,y,x+w/2,y+h,.07,.076,'glass',blind?'#e3c49c':'#b5c5be');
    for(const a of [-w/2,0,w/2])band(x+a-.025,y,x+a+.025,y+h,.078,.105,'oak',frame);
    band(x-w/2,y+h*.47,x+w/2,y+h*.47+.045,.078,.12,'oak','#747567');
    band(x-w/2-.17,y-.115,x+w/2+.17,y-.025,.0,.23,'stone',cream);
    band(x-w/2-.12,y+h+.02,x+w/2+.12,y+h+.16,.0,.15,'stone','#d8c6ab');
    if(blind)band(x-w/2+.05,y+h*.72,x+w/2-.04,y+h-.03,.115,.12,'plain','#c7b18e');
  }
  function facade(cx,z,dir,w,h,color,kind='house',base=.12){
    const depth=kind==='home'?7.32:10.4,zBack=z-dir*depth;
    const lo=Math.min(z,zBack),hi=Math.max(z,zBack);
    solid(cx-w/2,base,lo,cx+w/2,h,hi,'brick',color);
    function ledge(y,dh,out,mat,tint){
      box(cx-w/2-.085,y,Math.min(z+dir*out,zBack),cx+w/2+.085,y+dh,Math.max(z+dir*out,zBack),mat,tint);
    }
    for(const [y,dh,out] of [[h-.64,.13,.17],[h-.36,.13,.29],[h-.19,.19,.42]])ledge(y,dh,out,'stone','#ad9b83');
    for(let x=cx-w/2+.15;x<cx+w/2-.1;x+=.54)box(x,h-.49,Math.min(z,z+dir*.18),x+.15,h-.25,Math.max(z,z+dir*.18),'oak','#968774');
    const cols=Math.max(2,Math.round(w/2.7));
    for(let level=0,y=kind==='home'?4.57:1.06;y+1.9<h-.47;level++,y+=3.16)
      for(let j=0;j<cols;j++){
        if(!level&&kind!=='home'&&j===0)continue;
        windowBay(cx-w/2+(j+.5)*w/cols,y,z,dir,1.1,1.65,(j+level+Math.round(w))%4===0);
      }
    if(kind!=='home'){
      const x=cx-w/2+1.43,front=z+dir*.085;
      box(x-.70,.14,Math.min(z,front),x+.70,2.79,Math.max(z,front),'oak',green);
      for(const dx of [-.30,.30])windowBay(x+dx,1.69,front,dir,.43,.79);
      if(kind==='coffee'||kind==='watch'){
        const aw=kind==='coffee'?w-.55:w*.73,edge=z+dir*1.62;
        quad([cx-aw/2,2.62,edge],[cx+aw/2,2.62,edge],[cx+aw/2,3.32,z+dir*.05],[cx-aw/2,3.32,z+dir*.05],[0,.84,dir*.55],'awning',kind==='coffee'?'#f8e6c3':'#b2a68e');
        box(cx-aw/2,2.37,Math.min(edge,edge-dir*.05),cx+aw/2,2.64,Math.max(edge,edge-dir*.05),'awning','#e8d6ae');
        sign(cx,4.02,z+dir*.16,aw*.7,1.08,kind,dir);
      }
    }
  }
  facade(0,0,1,8.6,13.8,'#ead5bd','home',3.93);
  for(const [x,w,h,col] of [[-9.2,9.75,13.3,'#cfb194'],[-18.15,8.15,16.8,'#b99b88'],[9,9.4,14.8,'#b7a89c'],[17.5,7.6,11.4,'#e5bc99']])
    facade(x,0,1,w,h,col);
  for(const [x,w,h,col,kind] of [[-22,10,12.1,'#ccb295','house'],[-11,11.8,16,'#c5aea1','house'],[.2,10.5,13.8,'#e1cfab','watch'],[10.75,10.6,15.1,'#d7ac92','house'],[19.7,7.3,11.6,'#bba68c','coffee']])
    facade(x,17.9,-1,w,h,col,kind);
  // Street canyon continues beyond both intersections and behind the walkable block.
  for(const x of [-56,-46,-36,37,47,57]){
    facade(x,-.6,1,9.7,12+Math.abs(x)%6,'#c8b4a0');
    facade(x,17.9,-1,9.7,13+Math.abs(x)%7,'#d9b99b');
  }
  for(let i=-3;i<=3;i++)facade(i*8.3,-28,1,8.24,11.6+((i+4)*7)%8,'#bfa99b');
  for(let i=-8;i<=8;i++)for(const dir of [-1,1]){
    const x=i*10.1+dir*1.6,z=dir*(46+(i*i%4)*5),h=15+((i+9)*17+(dir+1)*2)%32;
    box(x-4,0,z-4,x+4,h,z+4,'brick','#ac9c94');
    for(let y=5;y<h-1;y+=3.1)box(x-3.8,y,dir<0?z+4:z-4.12,x+3.8,y+.62,dir<0?z+4.12:z-4,'glass','#929da0');
  }
  function fireEscape(x,z,h){
    for(let y=4.27;y<h-2;y+=3.16){
      box(x-1.55,y,z+.18,x+1.55,y+.11,z+1.06,'iron',metal);
      for(const dx of [-1.55,1.55])rod([x+dx,y+1.02,z+.18],[x+dx,y+1.02,z+1.07],.024,.024,'iron',metal,6);
      rod([x-1.56,y+1.0,z+1.04],[x+1.56,y+1.0,z+1.04],.026,.026,'iron',metal,6);
      for(let dx=-1.48;dx<=1.5;dx+=.24)box(x+dx,y+.1,z+1.00,x+dx+.025,y+1.01,z+1.045,'iron',metal);
      for(const dx of [-.24,.24])rod([x+dx-.83,y,z+.66],[x+dx+.76,y-3.14,z+.66],.028,.028,'iron',metal,7);
      for(let s=0;s<10;s++){const xx=x-.83+1.59*s/10,yy=y-3.14*s/10;
        rod([xx-.25,yy,z+.66],[xx+.25,yy,z+.66],.02,.02,'iron',metal,6);}
    }
  }
  fireEscape(-8.2,0,13.3);fireEscape(9.2,0,14.8);
  function tank(x,y,z){
    for(const dx of [-1.05,1.05])for(const dz of [-1.05,1.05]){
      rod([x+dx*1.33,y,z+dz*1.33],[x+dx,y+2.2,z+dz],.095,.09,'iron','#6f6354');
      rod([x-dx*1.33,y,z+dz*1.33],[x+dx,y+2.0,z+dz],.045,.045,'iron','#6f6354');}
    rod([x,y+2,z],[x,y+5.35,z],1.58,1.58,'oak','#b6a082',20);
    for(const yy of [2.08,2.75,3.60,4.55,5.22])rod([x,y+yy,z],[x,y+yy+.065,z],1.61,1.61,'iron','#82786b',20);
    rod([x,y+5.35,z],[x,y+6.42,z],1.77,.05,'iron','#8b8174',20);
  }
  tank(16.8,11.4,-4.5);tank(-11.3,16.0,22.2);tank(-39,18,-30);
  function lamp(x,z){
    solid(x-.13,.12,z-.13,x+.13,.43,z+.13,'iron','#778173');
    rod([x,.40,z],[x,3.88,z],.09,.048,'iron',metal);
    rod([x,3.84,z],[x,4.12,z],.16,.27,'iron',metal);
    rod([x,4.12,z],[x,4.52,z],.24,.18,'plain','#f2dbac',8);
    rod([x,4.52,z],[x,4.69,z],.29,.025,'iron',metal,8);
  }
  for(const [x,z] of [[-15,4.92],[14,4.92],[-12,14.65],[21.8,14.68],[-40,4.9],[44,4.9]])lamp(x,z);
  const poleX=21.8,poleZ=14.68;
  box(poleX-1,3.24,poleZ-.04,poleX+1,3.61,poleZ+.04,'iron',green);
  sign(poleX,3.425,poleZ-.045,1.94,.31,'orchard',-1);
  quad([poleX-.04,2.83,poleZ-.82],[poleX-.04,2.83,poleZ+.82],[poleX-.04,3.16,poleZ+.82],[poleX-.04,3.16,poleZ-.82],[-1,0,0],'ludlow');
  const hx=18.9,hz=4.95;
  rod([hx,.12,hz],[hx,.75,hz],.16,.13,'plain','#9b493a');
  rod([hx,.75,hz],[hx,.9,hz],.20,.065,'plain','#b45740');
  rod([hx-.26,.56,hz],[hx+.26,.56,hz],.09,.09,'iron','#915c4b');
  return {vertices:mesh.finish(),colliders:mesh.colliders,floors:mesh.floors};
}

export function buildChair() {
  const mesh=meshBuilder(),{rod,box}=mesh;
  // Local front is -z. Rotate the complete chair around the centre of its seat.
  box(-.235,.431,-.225,.235,.48,.22,'oak','#ba8b52');
  for(const sx of [-1,1])for(const sz of [-1,1])
    rod([sx*.225,.008,sz*.211],[sx*.17,.435,sz*.159],.019,.032,'oak','#916c43',9);
  for(const sx of [-1,1]){
    rod([sx*.205,.19,-.20],[sx*.205,.19,.20],.016,.016,'oak','#987246',8);
    rod([sx*.184,.46,.166],[sx*.216,.98,.266],.028,.034,'oak','#a57645',10);
  }
  for(let i=-2;i<=2;i++)rod([i*.064,.47,.176],[i*.075,.92,.257],.011,.016,'oak','#bb9057',8);
  box(-.235,.897,.225,.235,.989,.279,'oak','#a27a49');
  rod([-.205,.205,0],[.205,.205,0],.018,.018,'oak','#90693d',8);
  return mesh.finish();
}

export function floorAt(floors,x,z) {
  let h=0;
  for(const b of floors)if(x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1)h=Math.max(h,b.y1);
  return h;
}
export function blocks(colliders,x,z,feet,chair) {
  const head=feet+eyeHeight+.07;
  for(const b of colliders)if(b.y1>feet+.06&&b.y0<head&&
    x>b.x0-bodyRadius&&x<b.x1+bodyRadius&&z>b.z0-bodyRadius&&z<b.z1+bodyRadius)return true;
  return chair&&feet<chair.y+1&&head>chair.y&&Math.abs(x-chair.x)<bodyRadius+.235&&Math.abs(z-chair.z)<bodyRadius+.25;
}
