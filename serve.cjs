// Optional localhost-only server. The app also works by opening index.html directly.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname,port=Number(process.argv[2]||8766);
const buildInfo=require('./build-info.cjs');
// Installed biomes live in one small file beside the app, so they survive browser
// updates and cleared site data and are shared by every browser on this machine.
// Only this machine may read or write it: loopback host, same-origin, JSON only.
const STORE=path.join(root,'installed-biomes.json'),STORE_LIMIT=1048576,EMPTY_STORE='{"schema":1,"worlds":{}}';
function installedBiomes(req,res){
 const host=req.headers.host||'',origin=req.headers.origin,send=(code,body,type='application/json')=>res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(body);
 if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host)||(origin&&origin!=='http://'+host)){send(403,'{"error":"This machine only"}');return;}
 if(req.method==='GET'){fs.readFile(STORE,'utf8',(err,text)=>{if(err){send(err.code==='ENOENT'?200:500,err.code==='ENOENT'?EMPTY_STORE:'{"error":"Could not read installed biomes"}');return;}send(200,text);});return;}
 if(req.method!=='PUT'){send(405,'{"error":"GET or PUT"}');return;}
 if(!/^application\/json\b/.test(req.headers['content-type']||'')){send(415,'{"error":"JSON required"}');return;}
 const chunks=[];let size=0,refused=false;
 req.on('data',chunk=>{size+=chunk.length;if(size>STORE_LIMIT){if(!refused){refused=true;send(413,'{"error":"Too large"}');}return;}chunks.push(chunk);});
 req.on('end',()=>{if(refused)return;let text;try{text=Buffer.concat(chunks).toString('utf8');const value=JSON.parse(text);if(!value||value.schema!==1||!value.worlds||typeof value.worlds!=='object'||Array.isArray(value.worlds))throw Error('shape');text=JSON.stringify(value,null,1)+'\n';}catch{send(400,'{"error":"Not an installed-biomes record"}');return;}
  const temporary=STORE+'.writing';fs.writeFile(temporary,text,err=>{if(err){send(500,'{"error":"Could not write"}');return;}fs.rename(temporary,STORE,err=>{if(err){send(500,'{"error":"Could not replace"}');return;}send(200,'{"saved":true}');});});});
}
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.md':'text/plain'};
http.createServer((req,res)=>{let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}if(name==='/api/installed-biomes'){installedBiomes(req,res);return;}if(name==='/build-info.json'){try{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(buildInfo(root)));}catch{res.writeHead(500).end('Build metadata unavailable');}return;}const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,body)=>{if(err){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);});}).listen(port,'127.0.0.1',()=>console.log('Sphere Observatory: http://127.0.0.1:'+port));
