// Each surface is painted once at load time. Mipmaps filter mortar, grain and lettering
// across the whole block without a request per building.
export const materials = {};
const tiles = [];
const SIZE = 256;
let seed = 27;
function noise() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
function tile(name, base, metres, painter, sign = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
  const g = canvas.getContext('2d'); g.fillStyle = base; g.fillRect(0,0,SIZE,SIZE);
  painter?.(g);
  materials[name] = {index:tiles.length, metres, sign}; tiles.push(canvas);
}
function grit(g,count,alpha=0.12) {
  for(let i=0;i<count;i++){g.fillStyle=noise()>.5?'rgba(255,245,222,'+alpha+')':'rgba(35,23,19,'+alpha+')';
    g.fillRect(noise()*256,noise()*256,1+noise()*2,1+noise()*1.5);}
}
function line(g,x,y,xx,yy,color,width=1) {
  g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.moveTo(x,y);g.lineTo(xx,yy);g.stroke();
}
tile('plain','#ffffff',1);
tile('brick','#a9907d',1.9,g=>{
  for(let row=0;row<16;row++)for(let col=-1;col<8;col++){
    const x=col*32+(row%2)*16,y=row*16,v=Math.round(noise()*25);
    g.fillStyle='rgb('+(139+v)+','+(69+v*.75)+','+(51+v*.65)+')';g.fillRect(x+1,y+1,30.7,14.4);
    line(g,x+2,y+2,x+29,y+2,'#cf9c7755'); line(g,x+2,y+15,x+30,y+15,'#39251b55');
  }grit(g,17000,.14);
});
tile('stone','#b9ad95',1.4,g=>{grit(g,18500,.16);for(let i=0;i<85;i++){const x=noise()*256,y=noise()*256;line(g,x,y,x+noise()*19,y-1,'#64594c15');}});
tile('slab','#bbb7a9',2.15,g=>{grit(g,19000,.12);g.strokeStyle='#756f64';g.lineWidth=2;g.strokeRect(0,0,256,256);line(g,1,3,255,3,'#e2dac5');});
tile('road','#626269',1.7,g=>grit(g,22500,.22));
tile('plaster','#eee0bf',1.6,g=>grit(g,10500,.048));
tile('wood','#aa774a',1.55,g=>{
  for(let j=0;j<8;j++){const y=j*32;g.fillStyle='rgba(70,36,14,'+(noise()*.17)+')';g.fillRect(0,y,256,32);
    line(g,0,y,256,y,'#5e412c',1.8);const joint=Math.round(noise()*256);line(g,joint,y,joint,y+32,'#6d4931',1.35);
    for(let i=0;i<40;i++){const x=noise()*256,v=y+1+noise()*30;line(g,x,v,x+8+noise()*62,v+noise()*1.2,'rgba(60,32,12,'+noise()*.19+')');}}
});
tile('oak','#ad8152',.78,g=>{for(let i=0;i<2800;i++){let x=noise()*256,y=noise()*256;line(g,x,y,x+2+noise()*64,y+noise()*1.4,'rgba(55,29,12,'+noise()*.18+')');}});
tile('iron','#58605e',.54,g=>grit(g,9500,.09));
tile('glass','#546c71',1.35,g=>{const grad=g.createLinearGradient(0,0,160,256);grad.addColorStop(0,'#667b7a');grad.addColorStop(.52,'#a5b1aa');grad.addColorStop(1,'#536168');g.fillStyle=grad;g.fillRect(0,0,256,256);});
tile('awning','#e9d9a9',.95,g=>{g.fillStyle='#2e625d';g.fillRect(0,0,128,256);grit(g,5500,.07);});
tile('rug','#a95340',2.4,g=>{g.fillStyle='#ba785b';g.fillRect(12,12,232,232);g.fillStyle='#8e453b';g.fillRect(23,23,210,210);
  for(let y=0;y<7;y++)for(let x=0;x<7;x++){const u=32+x*32,v=32+y*32;g.fillStyle=(x+y)%2?'#ceab7c':'#45666a';g.beginPath();g.moveTo(u,v-8);g.lineTo(u+6,v);g.lineTo(u,v+8);g.lineTo(u-6,v);g.fill();}grit(g,9500,.12);});
function label(name,bg,fg,lines,aspect=1,border=true) {
  tile(name,bg,1,g=>{if(border){g.strokeStyle=fg;g.globalAlpha=.85;g.lineWidth=3;g.strokeRect(7,8,242,240);g.lineWidth=1;g.strokeRect(11,12,234,232);g.globalAlpha=1;}
    g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';
    g.save();g.scale(1/aspect,1);for(const [value,y,size,face='Georgia'] of lines){g.font='bold '+size+'px '+face;g.fillText(value,128*aspect,y,230*aspect);}g.restore();
    grit(g,1700,.055);
  },true);
}
label('address','#2d3938','#f4dfb4',[['27',102,132],['ORCHARD ST',196,29]]);
label('unit','#4a3428','#f1d8a4',[['1A',132,177]],2.5);
label('coffee','#285552','#f5e7c8',[['ELM COFFEE',137,132]],4.2);
label('orchard','#275249','#eee7cb',[['ORCHARD ST',132,159,'Arial']],6);
label('ludlow','#275249','#eee7cb',[['LUDLOW PL',132,153,'Arial']],5);
label('watch','#e4d5b2','#514537',[['WATCH REPAIR',132,130]],4.5);
tile('print','#ece0c1',1,g=>{g.fillStyle='#54777b';g.fillRect(20,18,216,168);g.fillStyle='#e5b576';g.beginPath();g.arc(174,59,21,0,2*Math.PI);g.fill();
  for(let i=0;i<14;i++){let h=30+noise()*87;g.fillStyle=i%2?'#2f4a50':'#3a5559';g.fillRect(21+i*15,186-h,16,h);}
  g.fillStyle='#314e51';g.font='bold 22px Georgia';g.textAlign='center';g.fillText('EAST RIVER',128,220);},true);

export function makeTexture(gl) {
  const texture=gl.createTexture(), levels=1+Math.log2(SIZE);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY,texture);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY,levels,gl.RGBA8,SIZE,SIZE,tiles.length);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  for(let i=0;i<tiles.length;i++)gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,i,SIZE,SIZE,1,gl.RGBA,gl.UNSIGNED_BYTE,tiles[i]);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  const aniso=gl.getExtension('EXT_texture_filter_anisotropic');
  if(aniso)gl.texParameterf(gl.TEXTURE_2D_ARRAY,aniso.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  return {texture,bytes:tiles.length*4*(4*SIZE*SIZE-1)/3};
}
