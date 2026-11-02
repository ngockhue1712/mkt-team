import http from 'node:http';
import worker from '../worker/index.js';
const portFlag=process.argv.indexOf('--port');
const port=Number(portFlag>=0?process.argv[portFlag+1]:process.env.PORT||3000);
http.createServer(async(req,res)=>{
 try {
  // Development-only viewport harness; not included in the production Worker.
  if(req.url==='/__qa/mobile'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html><head><title>390px UI preview</title></head><body style="margin:20px;background:#ddd8e9"><iframe title="Mobile preview" src="/" style="width:390px;height:844px;border:0;background:white"></iframe></body></html>');return;}
  const parts=[];for await(const chunk of req){parts.push(chunk);if(parts.reduce((n,p)=>n+p.length,0)>240000){res.writeHead(413);res.end();return;}}
  const url='http://'+req.headers.host+req.url;
  const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(parts)})});
  const response=await worker.fetch(request,{OPENAI_API_KEY:process.env.OPENAI_API_KEY});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Internal server error');}
}).listen(port,'0.0.0.0',()=>console.log('Local: http://localhost:'+port));
