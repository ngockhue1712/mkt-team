import assert from 'node:assert/strict';
import {runAgencyRequest} from '../lib/agency-work.mjs';
const id=crypto.randomUUID(), files=new Map(), seen=[];
function write(path,data){
  const etag=crypto.randomUUID();files.set(path,{data,etag});return {etag};
}
write('briefs/'+id+'.json',JSON.stringify({brief:{id,mode:'full',brief:'Lên chiến dịch thử nghiệm',deliverables:'Nội dung và media plan',brand:{}}}));
const storage={
  get:async path=>{const o=files.get(path);return o?{statusCode:200,stream:new Response(o.data).body,blob:{etag:o.etag}}:null;},
  put:async(path,data,opts)=>{
    const o=files.get(path);if(o && (!opts.allowOverwrite || o.etag!==opts.ifMatch))throw Error('etag conflict');
    assert.equal(opts.access,'private');return write(path,data);
  }
};
const infer=async({system,prompt,schema})=>{
  seen.push({system,prompt});
  if(system.includes('Bạn là Account của agency'))return 'Brief đã phân tích';
  if(system.includes('Bạn là người kiểm tra'))return 'ĐẠT: QA đọc bản bàn giao';
  return 'Kết quả phòng số '+seen.length;
};
const step=async(action,feedback='',generate=infer)=>{const response=await runAgencyRequest(new Request('https://mkt.example/api/work',{
  method:'POST',headers:{origin:'https://mkt.example','content-type':'application/json'},body:JSON.stringify({id,action,feedback,version:1})
}),{storage,infer:generate,authorize:async()=>true});return {code:response.status,...await response.json()};};
assert.equal((await step('approve')).code,409);
let resolveStart,release;
const started=new Promise(r=>resolveStart=r),done=new Promise(r=>release=r);
const concurrent=step('advance','',async args=>{resolveStart();await done;return infer(args)});
await started;assert.equal((await step('advance')).code,202);release();await concurrent;
let job;
for(let i=0;i<5;i++)({job}=await step('advance'));
assert.equal(job.status,'review');assert.equal(seen.length,6);assert.equal(job.calls,6);
assert.ok(seen[2].prompt.includes('Kết quả phòng số 2'));assert.ok(seen[5].prompt.includes('Kết quả phòng số 5'));
assert.equal((await step('advance')).job.calls,6);
assert.equal((await step('approve')).job.status,'approved');assert.equal((await step('status')).job.status,'approved');
assert.equal((await step('revise','Đổi CTA')).job.version,2);
assert.equal((await step('advance','',async()=>{throw Error('injected worker failure')})).job.status,'error');
assert.equal((await step('advance')).job.status,'running');assert.ok(seen.at(-1).prompt.includes('Đổi CTA'));
console.log('PASS: six independent role invocations, handoffs, durable review, concurrency, retry and revision.');

const scoped=crypto.randomUUID();
write('briefs/'+scoped+'.json',JSON.stringify({brief:{id:scoped,mode:'single',department:'content',brief:'Viết 3 caption cho trà sen',deliverables:'Gợi ý ảnh cho mỗi bài',brand:{}}}));
let generated=0;const phases=[];
while(true) {
  const response=await runAgencyRequest(new Request('https://mkt.example/api/work',{method:'POST',headers:{origin:'https://mkt.example','content-type':'application/json'},body:JSON.stringify({id:scoped,action:'advance'})}),
  {storage,authorize:async()=>true,infer:async({prompt})=>{generated++;phases.push(prompt);return 'Đạt tiêu chí bài viết.\nẢnh: Lá sen.';}});
  const {job:scopedJob}=await response.json();if(scopedJob.status==='review'){
    assert.equal(scopedJob.calls,5);assert.equal(scopedJob.captions.length,3);assert.match(scopedJob.outputs.content,/Caption 3/);break;}
  assert.ok(generated<=5);
}
assert.ok(phases.at(-1).includes('Caption 3'));

const denied=await runAgencyRequest(new Request('https://mkt.example/api/work',{method:'POST',headers:{origin:'https://mkt.example','content-type':'application/json'},body:JSON.stringify({id,action:'status'})}),{storage,infer,authorize:async()=>false});
assert.equal(denied.status,403);
