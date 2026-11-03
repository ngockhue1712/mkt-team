import assert from 'node:assert/strict';
import {generateGPTImage,imageMode,readGPTImage} from '../lib/gpt-image.mjs';

const rows=new Map(),storage={
  head:async k=>rows.has(k)?{size:rows.get(k).length}:null,
  get:async k=>rows.has(k)?{statusCode:200,stream:new Response(rows.get(k)).body}:null,
  put:async(k,v,o)=>{assert.equal(o.access,'private');assert.equal(o.allowOverwrite,false);if(rows.has(k))throw Error('already exists');rows.set(k,v);}
};
const brief={id:crypto.randomUUID(),brief:'Quán Mây muốn ảnh chụp ly cà phê.',brand:{}};
const job={version:1,artwork:[{width:1080,height:1080,title:'Hẹn cà phê'}],outputs:{creative:'Ánh sáng cửa sổ.'}};
let sends=0,revisionStyle='';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAABAAAAAQAAQAAAABXZhYuAAAAlklEQVR42u3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADvBgQeAAEN3jhkAAAAAElFTkSuQmCC','base64');
const send=async(url,{headers,body})=>{
  sends++;assert.equal(url,'https://api.openai.com/v1/images/generations');assert.equal(headers.Authorization,'Bearer test-server-key');assert.match(body,/Quán Mây/);
  const p=JSON.parse(body);assert.equal(p.output_format,'png');assert.equal(p.n,1);assert.equal(p.size,'1024x1024');revisionStyle=p.prompt;
  return Response.json({data:[{b64_json:png.toString('base64')}]});
};
const deps={storage,send,apiKey:'test-server-key',dailyLimit:2};
assert.equal((await generateGPTImage(brief,job,{...deps,apiKey:''})).status,'unavailable');assert.equal(sends,0);
const both=await Promise.all([generateGPTImage(brief,job,deps),generateGPTImage(brief,job,deps)]);
assert.ok(both.some(r=>r.status==='ready'));assert.equal(sends,1);assert.match(revisionStyle,/photorealistic/);
const repeated=await generateGPTImage(brief,job,deps);assert.equal(repeated.asset.kind,'gpt');assert.equal(sends,1);
job.feedback='Đổi sang ảnh thiết kế màu hồng với headline mới.';job.version++;
assert.equal(imageMode(brief,job),'design');
await generateGPTImage(brief,job,deps);assert.equal(sends,2);assert.match(revisionStyle,/graphic/);assert.match(revisionStyle,/màu hồng/);
job.version++;assert.equal((await generateGPTImage(brief,job,deps)).status,'unavailable');assert.equal(sends,2);
const url='https://mkt.example/api/image?id='+brief.id+'&v=1';
const authorize=async(id,auth)=>id===brief.id&&auth==='Bearer test-order';
assert.equal((await readGPTImage(new Request(url),{storage,authorize})).status,403);
const res=await readGPTImage(new Request(url,{headers:{Authorization:'Bearer test-order'}}),{storage,authorize});
assert.equal(res.headers.get('content-type'),'image/png');assert.ok(Buffer.from(await res.arrayBuffer()).equals(png));
console.log('PASS: actual PNG bytes, private access, photo/design prompts, per-version idempotency, daily cap, keyless fallback.');
