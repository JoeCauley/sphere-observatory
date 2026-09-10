// Local visual-test artifact sink. Run manually; never part of the public app server.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'artifacts','hero');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname;
 if(req.method==='POST'&&/^\/capture\/(baseline|attempt[123])\/[a-z0-9-]+\.png$/.test(name)){
  let size=0,chunks=[];req.on('data',c=>{size+=c.length;if(size>16000000){req.destroy();return;}chunks.push(c);});req.on('end',()=>{const file=path.join(out,name.slice(9));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.concat(chunks));res.end('saved');});return;
 }
 if(req.method!=='GET'){res.writeHead(405).end();return;}
 const file=path.resolve(root,'.'+decodeURIComponent(name));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
}).listen(8767,'127.0.0.1',()=>console.log('Hero review: http://127.0.0.1:8767/tests/hero-review.html'));
