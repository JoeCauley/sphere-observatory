/* Read-only native component server. It never writes project or service records. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),repo=path.resolve(__dirname,'..'),port=Number(process.argv[2]);
if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('An explicitly selected fresh port is required');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.zip':'application/zip'};
http.createServer((request,response)=>{
 let name;try{name=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch(cause){response.writeHead(400).end();return;}
 if(name==='/__biome_ingestion_probe__/redirect'){response.writeHead(302,{Location:'/tests/fixtures/biome-service/design-examples/fixture-open-industry/manifest.json'}).end();return;}
 if(name==='/__biome_ingestion_probe__/eleven-bytes'){response.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':11,'Cache-Control':'no-store'}).end('12345678901');return;}
 const file=path.resolve(repo,'.'+(name==='/'?'/tests/biome-service-ingestion-browser.html':name));if(!file.startsWith(repo+path.sep)){response.writeHead(403).end();return;}
 fs.readFile(file,(error,raw)=>{if(error){response.writeHead(404).end('Not found');return;}response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(raw);});
}).listen(port,'127.0.0.1',()=>console.log('Isolated ingestion component review: http://127.0.0.1:'+port+'/tests/biome-service-ingestion-browser.html'));
