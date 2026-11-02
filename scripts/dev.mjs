import http from 'node:http';
import worker from '../worker/index.js';
const port=Number(process.env.PORT||3000);
http.createServer(async(req,res)=>{
 try {
  const parts=[];for await(const chunk of req){parts.push(chunk);if(parts.reduce((n,p)=>n+p.length,0)>240000){res.writeHead(413);res.end();return;}}
  const url='http://'+req.headers.host+req.url;
  const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(parts)})});
  const response=await worker.fetch(request,{OPENAI_API_KEY:process.env.OPENAI_API_KEY});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Internal server error');}
}).listen(port,'0.0.0.0',()=>console.log('Local: http://localhost:'+port));
