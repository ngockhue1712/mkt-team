import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import worker from '../worker/index.js';
const page=await readFile(new URL('../ui.html',import.meta.url),'utf8');
const script=page.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
const origin='https://agency.example';
const post=(body,extra={})=>new Request(origin+'/api/generate',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
const data={role:'content',context:'Viết một caption',model:'test-model',apiKey:'test-only-key'};
assert.equal((await worker.fetch(new Request(origin+'/'),{})).status,200);
assert.deepEqual(await (await worker.fetch(new Request(origin+'/api/status'),{})).json(),{configured:false});
assert.equal((await worker.fetch(post(data,{Origin:'https://evil.example'}),{})).status,403);
assert.equal((await worker.fetch(post({...data,role:'__proto__'}),{})).status,400);
assert.equal((await worker.fetch(post({...data,apiKey:''}),{})).status,428);
let upstream;const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{upstream={url,...init};return Response.json({status:'completed',output:[{content:[{type:'output_text',text:'Đầu ra AI đã kiểm thử'}]}],usage:{total_tokens:25}});};
try{
 const result=await worker.fetch(post(data),{});assert.equal(result.status,200);assert.equal((await result.json()).output,'Đầu ra AI đã kiểm thử');
 assert.equal(upstream.url,'https://api.openai.com/v1/responses');assert.equal(JSON.parse(upstream.body).store,false);assert.equal(upstream.headers.Authorization,'Bearer test-only-key');
 globalThis.fetch=async()=>Response.json({error:{code:'insufficient_quota'}},{status:429});assert.equal((await worker.fetch(post(data),{})).status,429);
 globalThis.fetch=async()=>Response.json({status:'incomplete',output:[]});assert.equal((await worker.fetch(post(data),{})).status,502);
}finally{globalThis.fetch=originalFetch;}
// Exercise the real client orchestrator, mocking only network/UI/storage.
const store=new Map();const nodes=new Proxy({}, {get:()=>({innerHTML:'',className:'',textContent:'',classList:{toggle(){}},value:''})});
const sandbox={console,crypto:globalThis.crypto,Blob,URL,Request,Response,setTimeout,clearTimeout,FormData,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},document:{querySelector:s=>nodes[s],querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){},scrollTo(){}},fetch:async()=>Response.json({configured:false})};
vm.createContext(sandbox);vm.runInContext(script,sandbox);vm.runInContext('render=()=>{};toast=()=>{};apiKey="test";',sandbox);
const outputs={account:JSON.stringify({needs_clarification:false,questions:[],summary:'Đủ brief',departments:['strategy','content'],acceptance:['2 bài']}),strategy:'Chiến lược',content:'Bài 1 và bài 2',qa:JSON.stringify({passed:true,summary:'Đạt',issues:[],checklist:[{criterion:'2 bài',passed:true}]})};
const calls=[];sandbox.fetch=async(url,opts)=>{const p=JSON.parse(opts.body);calls.push(p);return Response.json({output:outputs[p.role]});};
await vm.runInContext('(async()=>{state.orders=[{id:"test-order",title:"Campaign",mode:"full",brief:"Brief",deliverables:"2 bài",brand:{},outputs:{},history:[],pipeline:["account"],calls:0}];await execute(state.orders[0]);})()',sandbox);
assert.equal(vm.runInContext('state.orders[0].status',sandbox),'review');assert.deepEqual(calls.map(c=>c.role),['account','strategy','content','qa']);assert.ok(calls[2].context.includes('Chiến lược'));assert.ok(calls[3].context.includes('Bài 1 và bài 2'));
// A single-department order must override an over-broad account plan.
calls.length=0;await vm.runInContext('(async()=>{state.orders=[{id:"single",title:"Caption",mode:"single",department:"content",brief:"Brief",deliverables:"2 bài",brand:{},outputs:{},history:[],pipeline:["account"],calls:0}];await execute(state.orders[0]);})()',sandbox);
assert.deepEqual(calls.map(c=>c.role),['account','content','qa']);
// Provider failure must preserve completed handoff and resume without rerunning it.
calls.length=0;sandbox.fetch=async(url,opts)=>{const p=JSON.parse(opts.body);calls.push(p);if(p.role==='content')return Response.json({error:'Quota'},{status:429});return Response.json({output:outputs[p.role]});};
await vm.runInContext('(async()=>{state.orders=[{id:"retry",title:"Caption",mode:"single",department:"content",brief:"Brief",deliverables:"2 bài",brand:{},outputs:{},history:[],pipeline:["account"],calls:0}];await execute(state.orders[0]);})()',sandbox);
assert.equal(vm.runInContext('state.orders[0].status',sandbox),'error');assert.ok(vm.runInContext('state.orders[0].outputs.account',sandbox));calls.length=0;sandbox.fetch=async(url,opts)=>{const p=JSON.parse(opts.body);calls.push(p);return Response.json({output:outputs[p.role]});};await vm.runInContext('execute(state.orders[0])',sandbox);assert.deepEqual(calls.map(c=>c.role),['content','qa']);
console.log('PASS: UI syntax, endpoint validation, no-key handling, upstream errors, real pipeline handoffs, single-department routing and error resume. AI network calls mocked; live AI not tested.');
