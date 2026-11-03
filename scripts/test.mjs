import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import worker from '../worker/index.js';
const page=await readFile(new URL('../ui.html',import.meta.url),'utf8');
const script=await readFile(new URL('../office-ui.js',import.meta.url),'utf8')+'\n'+page.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(await readFile(new URL('../voxel-office.js',import.meta.url),'utf8'));
new vm.Script(script);
const origin='https://agency.example';
const post=(body,extra={})=>new Request(origin+'/api/generate',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
const data={role:'content',context:'Viết một caption',model:'test-model',apiKey:'test-only-key'};
assert.equal((await worker.fetch(new Request(origin+'/'),{})).status,200);
for(const [path,type] of [['voxel-office.js','javascript'],['office-ui.js','javascript'],['voxel-ui.css','css']]){
 const asset=await worker.fetch(new Request(origin+'/assets/'+path+'?v=3'),{});
 assert.equal(asset.status,200);assert.ok(asset.headers.get('Content-Type').includes(type));assert.ok((await asset.text()).length>1000);
}
assert.deepEqual(await (await worker.fetch(new Request(origin+'/api/status'),{})).json(),{configured:false});
assert.equal((await worker.fetch(post(data,{Origin:'https://evil.example'}),{})).status,403);
assert.equal((await worker.fetch(post({...data,role:'__proto__'}),{})).status,400);
assert.equal((await worker.fetch(post({...data,apiKey:''}),{})).status,428);
assert.equal((await worker.fetch(post(null),{})).status,400);
assert.equal((await worker.fetch(post([]),{})).status,400);
let upstream;const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{upstream={url,...init};return Response.json({status:'completed',output:[{content:[{type:'output_text',text:'Đầu ra AI đã kiểm thử'}]}],usage:{total_tokens:25}});};
try{
 const result=await worker.fetch(post(data),{});assert.equal(result.status,200);assert.equal((await result.json()).output,'Đầu ra AI đã kiểm thử');
 assert.equal(upstream.url,'https://api.openai.com/v1/responses');assert.equal(JSON.parse(upstream.body).store,false);assert.equal(upstream.headers.Authorization,'Bearer test-only-key');
 globalThis.fetch=async()=>Response.json({error:{code:'insufficient_quota'}},{status:429});assert.equal((await worker.fetch(post(data),{})).status,429);
 globalThis.fetch=async()=>Response.json({status:'incomplete',output:[]});assert.equal((await worker.fetch(post(data),{})).status,502);
 const captured=[];
 globalThis.fetch=async (url,init)=>{
   const request=JSON.parse(init.body);captured.push(request);
   if(request.text){
     assert.match(request.input,/JSON/);
     return Response.json({error:{param:'text.format',message:'Unsupported format json_object for this model'}},{status:400});
   }
   return Response.json({status:'completed',output:[{content:[{type:'output_text',text:'```json\n{"summary":"Đã nhận"}\n```'}]}]});
 };
 const compatible=await worker.fetch(post({...data,role:'account'}),{});
 assert.equal(compatible.status,200);
 assert.equal(JSON.parse((await compatible.json()).output).summary,'Đã nhận');
 assert.equal(captured.length,2);
 const failures=[
   [401,'invalid_api_key','API key'], [403,'permission_denied','quyền'],[404,'model_not_found','model'],
   [429,'insufficient_quota','hạn mức'],[429,'rate_limit_exceeded','tần suất'],
   [400,'context_length_exceeded','dung lượng'],[400,'unsupported_parameter','định dạng'],[503,'server_error','tạm thời']
 ];
 for(const [status,code,expected] of failures){
   let n=0;
   globalThis.fetch=async()=>{n++;return Response.json({error:{code,param:'input',message:'Private context and key should never appear'}},{status,headers:{'x-request-id':'req_example'}});};
   const r=await worker.fetch(post({...data,role:'qa'}),{});
   const b=await r.json();assert.equal(n,1);assert.ok(b.error.includes(expected));assert.ok(b.error.includes('req_example'));assert.ok(!b.error.includes('Private context'));
 }
 let probeCalls=0;
 globalThis.fetch=async(url,init)=>{
   probeCalls++;assert.equal(url,'https://api.openai.com/v1/models/test-model');assert.equal(init.body,undefined);
   assert.equal(init.headers.Authorization,'Bearer test-key');return Response.json({object:'model',id:'test-model'});
 };
 const probe=new Request(origin+'/api/connection',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({apiKey:'test-key',model:'test-model'})});
 assert.deepEqual(await (await worker.fetch(probe,{})).json(),{model:'test-model'});assert.equal(probeCalls,1);
}finally{globalThis.fetch=originalFetch;}
// Exercise the real client orchestrator, mocking only network/UI/storage.
const store=new Map();const nodes=new Proxy({}, {get:()=>({innerHTML:'',className:'',textContent:'',classList:{toggle(){}},value:''})});
const sandbox={console,crypto:globalThis.crypto,Blob,URL,Request,Response,setTimeout,clearTimeout,FormData,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},document:{getElementById:()=>null,querySelector:s=>nodes[s],querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){},scrollTo(){}},fetch:async()=>Response.json({configured:false})};
vm.createContext(sandbox);vm.runInContext(script,sandbox);vm.runInContext('render=()=>{};toast=()=>{};apiKey="test";',sandbox);
const nativeCrypto=sandbox.crypto;sandbox.crypto={getRandomValues:a=>nativeCrypto.getRandomValues(a)};
assert.match(vm.runInContext('orderId()',sandbox),/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);sandbox.crypto=nativeCrypto;
const outputs={account:JSON.stringify({needs_clarification:false,questions:[],summary:'Đủ brief',departments:['strategy','content'],acceptance:['2 bài']}),strategy:'Chiến lược',content:'Bài 1 và bài 2',qa:JSON.stringify({passed:true,summary:'Đạt',issues:[],checklist:[{criterion:'2 bài',passed:true}]})};
const calls=[];sandbox.fetch=async(url,opts)=>{const p=JSON.parse(opts.body);calls.push(p);return Response.json({output:outputs[p.role]});};
await vm.runInContext('(async()=>{state.orders=[{id:"test-order",title:"Campaign",mode:"full",brief:"Brief",deliverables:"2 bài",brand:{},outputs:{},history:[],pipeline:["account"],calls:0}];await execute(state.orders[0]);})()',sandbox);
assert.equal(vm.runInContext('state.orders[0].status',sandbox),'review');assert.deepEqual(calls.map(c=>c.role),['account','strategy','content','qa']);assert.ok(calls[2].context.includes('Chiến lược'));assert.ok(calls[3].context.includes('Bài 1 và bài 2'));
// A single-department order must override an over-broad account plan.
calls.length=0;await vm.runInContext('(async()=>{state.orders=[{id:"single",title:"Caption",mode:"single",department:"content",brief:"Brief",deliverables:"2 bài",brand:{},outputs:{},history:[],pipeline:["account"],calls:0}];await execute(state.orders[0]);})()',sandbox);
assert.deepEqual(calls.map(c=>c.role),['account','content','qa']);
// All six visible rooms accept scoped orders, including Account and QA deliverables.
outputs.account_work='Brief chuẩn hóa và phạm vi công việc';outputs.qa_work='Báo cáo rà soát tài liệu';outputs.creative='Brief thiết kế';outputs.performance='Media plan';
for(const department of ['account','strategy','content','creative','performance','qa']){
 calls.length=0;sandbox.department=department;
 await vm.runInContext('(async()=>{state.orders=[{id:"room",title:"Order riêng",mode:"single",department,brief:"Brief",deliverables:"Theo brief",brand:{},outputs:{},history:[],pipeline:["account"],calls:0}];await execute(state.orders[0]);})()',sandbox);
 const work=department==='account'?'account_work':department==='qa'?'qa_work':department;
 assert.deepEqual(calls.map(c=>c.role),['account',work,'qa']);assert.equal(vm.runInContext('state.orders[0].status',sandbox),'review');
}
// Home and room intake preserve scope and create real recoverable drafts without a key.
await vm.runInContext('apiKey="";serverConfigured=false;openConnection=()=>{};state.orders=[];state.uiDrafts={content:{brief:"Draft"},home:{brief:"Home draft"}};',sandbox);
await vm.runInContext('submitOrder({mode:"single",department:"content",brief:"Viết 5 caption",deliverables:"5 caption",draftScope:"content"})',sandbox);
assert.equal(vm.runInContext('state.orders[0].department',sandbox),'content');assert.equal(vm.runInContext('state.orders[0].status',sandbox),'draft');assert.equal(vm.runInContext('state.orders[0].calls',sandbox),0);
assert.equal(vm.runInContext('state.uiDrafts.content',sandbox),undefined);assert.equal(vm.runInContext('state.uiDrafts.home.brief',sandbox),'Home draft');
await vm.runInContext('submitOrder({mode:"full",brief:"Lên campaign tháng 12",draftScope:"home"})',sandbox);
assert.equal(vm.runInContext('state.orders[0].mode',sandbox),'full');assert.equal(vm.runInContext('state.orders.length',sandbox),2);
await vm.runInContext('submitOrder({mode:"full",brief:"  "})',sandbox);assert.equal(vm.runInContext('state.orders.length',sandbox),2);
await vm.runInContext('state.uiDrafts={content:{brief:"Bản nháp Content",deliverables:"5 bài"},strategy:{brief:"Bản nháp Strategy"}};openRoom("content");openRoom("strategy");',sandbox);
assert.equal(vm.runInContext('selectedRoom',sandbox),'strategy');assert.equal(vm.runInContext('quickDraft("content").brief',sandbox),'Bản nháp Content');
vm.runInContext('apiKey="test";',sandbox);
// Provider failure must preserve completed handoff and resume without rerunning it.
calls.length=0;sandbox.fetch=async(url,opts)=>{const p=JSON.parse(opts.body);calls.push(p);if(p.role==='content')return Response.json({error:'Quota'},{status:429});return Response.json({output:outputs[p.role]});};
await vm.runInContext('(async()=>{state.orders=[{id:"retry",title:"Caption",mode:"single",department:"content",brief:"Brief",deliverables:"2 bài",brand:{},outputs:{},history:[],pipeline:["account"],calls:0}];await execute(state.orders[0]);})()',sandbox);
assert.equal(vm.runInContext('state.orders[0].status',sandbox),'error');assert.ok(vm.runInContext('state.orders[0].outputs.account',sandbox));calls.length=0;sandbox.fetch=async(url,opts)=>{const p=JSON.parse(opts.body);calls.push(p);return Response.json({output:outputs[p.role]});};await vm.runInContext('execute(state.orders[0])',sandbox);assert.deepEqual(calls.map(c=>c.role),['content','qa']);
// Missing information must stop before specialist spending.
calls.length=0;sandbox.fetch=async(url,opts)=>{const p=JSON.parse(opts.body);calls.push(p);return Response.json({output:JSON.stringify({needs_clarification:true,questions:['Khách hàng là ai?'],summary:'Thiếu brief',departments:[],acceptance:[]})});};
await vm.runInContext('(async()=>{state.orders=[{id:"clarify",title:"Thiếu",mode:"full",brief:"Làm campaign",deliverables:"Nội dung",brand:{},outputs:{},history:[],pipeline:["account"],calls:0}];await execute(state.orders[0]);})()',sandbox);
assert.deepEqual(calls.map(c=>c.role),['account']);assert.equal(vm.runInContext('state.orders[0].status',sandbox),'clarify');
// QA failure must never produce a ready-to-approve state.
sandbox.fetch=async(url,opts)=>{const p=JSON.parse(opts.body);return Response.json({output:p.role==='qa'?JSON.stringify({passed:false,summary:'Thiếu bài',issues:[{department:'content',issue:'Thiếu',fix:'Viết thêm'}],checklist:[{criterion:'2 bài',passed:false}]}):outputs[p.role]});};
await vm.runInContext('(async()=>{state.orders=[{id:"qa-fail",title:"QA",mode:"single",department:"content",brief:"Brief",deliverables:"2 bài",brand:{},outputs:{},history:[],pipeline:["account"],calls:0}];await execute(state.orders[0]);})()',sandbox);
assert.equal(vm.runInContext('state.orders[0].status',sandbox),'qa_failed');
await vm.runInContext('activeId="qa-fail";activeTab="qa";',sandbox);assert.match(vm.runInContext('detail()',sandbox),/id="approve" disabled/);
vm.runInContext('state.orders[0].status="draft";',sandbox);assert.match(vm.runInContext('detail()',sandbox),/id="startDraft"/);
// Revision invalidates dependent outputs but preserves prior versions.
vm.runInContext('execute=()=>{};revise(state.orders[0],"Sửa giọng điệu",true);',sandbox);
assert.ok(vm.runInContext('state.orders[0].outputs.account',sandbox));assert.equal(vm.runInContext('state.orders[0].outputs.content',sandbox),undefined);assert.equal(vm.runInContext('state.orders[0].history.length',sandbox),2);
const adapter=await import('../api/generate.js');
process.env.OPENAI_API_KEY='owner-key-must-not-be-used';
assert.equal((await adapter.default.fetch(post({...data,apiKey:''}))).status,428);
delete process.env.OPENAI_API_KEY;
// Verify the whole geometric scene fits the supported desktop and mobile stages.
const drawContext=new Proxy({}, {get:()=>()=>{}});
const makeElement=()=>({style:{setProperty(){}},dataset:{},classList:{add(){},toggle(){}},setAttribute(){},append(){},getContext:()=>drawContext,addEventListener(){},removeEventListener(){},remove(){}});
const voxelSandbox={window:{devicePixelRatio:1},document:{createElement:makeElement},ResizeObserver:class{observe(){}disconnect(){}}};
vm.createContext(voxelSandbox);vm.runInContext(await readFile(new URL('../voxel-office.js',import.meta.url),'utf8'),voxelSandbox);
for(const [width,height] of [[1224,490],[800,490],[343,270]]){
 const host={...makeElement(),clientWidth:width,clientHeight:height};const scene=new voxelSandbox.window.VoxelOffice(host,{});
 for(const box of scene.boxes)for(const dx of [-1,1])for(const dy of [-1,1])for(const dz of [-1,1]){
  const point=scene.project(box.x+dx*box.w/2,box.y+dy*box.h/2,box.z+dz*box.d/2);
  assert.ok(point.x>=0&&point.x<=width&&point.y>=0&&point.y<=height,'Voxel geometry clipped at '+width+'×'+height);
 }
 scene.select('content');assert.equal(scene.selected,'content');scene.destroy();
}
console.log('PASS: assets and UI syntax; six-room routing; home/scoped intake; draft recovery; HTTP UUID fallback; input validation; handoffs; resume; clarification; QA gate; revisions; viewport geometry; Vercel key isolation. AI network mocked; live AI not tested.');
