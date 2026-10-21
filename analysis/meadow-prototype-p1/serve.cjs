'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cfg=require('./last-run.json');
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),out=path.join(cfg.evidence,'review-server-'+stamp),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out);fs.mkdirSync(path.join(out,'source'));
for(const name of ['serve.cjs','demo-ui.js','canopy-p1.js','tile-planner-p1.js'])fs.copyFileSync(path.join(__dirname,name),path.join(out,'source',name));
const build=require(path.join(cfg.runtime,'build-info.cjs'))(cfg.runtime);assert.equal(build.sourceSha256,cfg.baselineBuild.sourceSha256);assert.equal(build.assetSetSha256,cfg.baselineBuild.assetSetSha256);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'},requests=[];
const server=http.createServer((req,res)=>{
 let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return res.writeHead(400).end();}
 if(name==='/build-info.json')return res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(build));
 let file;
 if(name==='/review')file=path.join(cfg.evidence,'review.html');
 else if(name.startsWith('/proof/'))file=path.resolve(cfg.evidence,'.'+name.slice(6));
 else if(/^\/prototype\/(demo-ui|canopy-p1|tile-planner-p1)\.js$/.test(name))file=path.join(out,'source',path.basename(name));
 else file=path.resolve(cfg.runtime,'.'+(name==='/'||name==='/demo'?'/index.html':name));
 if(!file.startsWith(cfg.runtime+path.sep)&&!file.startsWith(out+path.sep)&&!file.startsWith(cfg.evidence+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();if((name==='/'||name==='/demo'))data=Buffer.from(data.toString().replace('</body>','<script src="prototype/demo-ui.js"></script></body>'));
  requests.push({path:name,bytes:data.length,sha256:sha(data)});res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
 });
});
const record={schema:1,profile:'meadow-prototype-p1',revision:2,pid:process.pid,createdAt:new Date().toISOString(),runtime:cfg.runtime,baselineBuild:build,overlayScope:'Only owned server HTML injection and frozen prototype scripts. The production server and files are untouched.',requests};
const save=()=>fs.writeFileSync(path.join(out,'server.json'),JSON.stringify(record,null,2)+'\n');
server.listen(Number(process.argv[2]||0),'127.0.0.1',()=>{record.address=server.address();record.url='http://127.0.0.1:'+record.address.port+'/demo';record.reviewUrl='http://127.0.0.1:'+record.address.port+'/review';save();console.log(JSON.stringify({url:record.url,reviewUrl:record.reviewUrl,out,pid:process.pid}));});
function stop(){record.closedAt=new Date().toISOString();save();server.close(()=>process.exit(0));}
process.on('SIGINT',stop);process.on('SIGTERM',stop);process.on('exit',save);
