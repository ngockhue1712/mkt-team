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
  {storage,authorize:async()=>true,infer:async({prompt})=>{generated++;phases.push(prompt);return prompt.includes('bức ảnh')?'Chụp lá sen cạnh ấm trà dưới ánh sáng sớm.':'Trong buổi sáng đầu tuần hãy dành cho mình một khoảng lặng với tách trà sen thơm nhẹ trên bàn. Cùng bạn bè chia sẻ một câu chuyện nhỏ bên ấm trà để bắt đầu ngày mới theo một cách riêng.';}});
  const {job:scopedJob}=await response.json();if(scopedJob.status==='review'){
    assert.equal(scopedJob.calls,8);assert.equal(scopedJob.captions.length,3);assert.match(scopedJob.outputs.content,/Caption 3/);break;}
  assert.ok(generated<=8);
}
assert.ok(phases.at(-1).includes('Caption 3'));

const denied=await runAgencyRequest(new Request('https://mkt.example/api/work',{method:'POST',headers:{origin:'https://mkt.example','content-type':'application/json'},body:JSON.stringify({id,action:'status'})}),{storage,infer,authorize:async()=>false});
assert.equal(denied.status,403);

// After intake, the client disappears. The production dispatch and worker alone
// must finish all six roles, including a second version after review feedback.
const {dispatchOrder}=await import('../lib/dispatch-order.mjs');
const {receiveBrief}=await import('../lib/brief-inbox.mjs');
const coldId=crypto.randomUUID(),origin='https://mkt.example',credential='test-order-token',pending=[];
const env={VERCEL_ENV:'production',VERCEL_PROJECT_PRODUCTION_URL:'mkt.example'};
const accepted=await receiveBrief(new Request(origin+'/api/briefs',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({id:coldId,mode:'full',brief:'Viết kế hoạch cho hội sách.'})}),storage);
assert.equal(accepted.status,201);
const receipt=await accepted.json();
let deliveries=0;
const send=async(url,options)=>{
  assert.equal(new URL(url).origin,origin);
  if (!deliveries++) return new Response(null,{status:503});
  return runAgencyRequest(new Request(url,options),services);
};
const kick=()=>dispatchOrder(receipt.id,credential,{env,send});
const services={storage,infer,defer:promise=>pending.push(promise),continueOrder:kick,authorize:async (order,auth)=>order===coldId && auth==='Bearer '+credential};
assert.equal(await kick(),true);
async function drain(){while(pending.length)await pending.shift();}
await drain();
const savedJob=()=>JSON.parse(files.get('outcomes/'+coldId+'.json').data);
assert.equal(savedJob().status,'review');
assert.equal(Object.keys(savedJob().outputs).length,6);
await kick();await drain();assert.equal(savedJob().calls,6);
const revised=await send(origin+'/api/work',{method:'POST',headers:{origin,'Content-Type':'application/json',Authorization:'Bearer '+credential},body:JSON.stringify({id:coldId,action:'revise',feedback:'Chuyển sang giọng gần gũi hơn.',version:1})});
assert.equal(revised.status,200);await drain();
assert.equal(savedJob().version,2);assert.equal(savedJob().status,'review');assert.ok(savedJob().outputs.qa);
assert.equal(await dispatchOrder(coldId,credential,{env:{VERCEL_ENV:'preview'},send:()=>assert.fail()}),false);
console.log('PASS: browser-independent receipt to six outputs, retry, duplicate delivery and revision.');
