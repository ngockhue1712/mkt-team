import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { receiveBrief } from '../lib/brief-inbox.mjs';

const origin = 'https://inbox.example';
const rows = new Map();
const storage = {
  put: async (path, data, options) => {
    assert.equal(options.access, 'private');
    assert.equal(options.allowOverwrite, false);
    if (rows.has(path)) throw Error('existing');
    rows.set(path, data);
  },
  get: async path => rows.has(path) ? { statusCode: 200, stream: new Response(rows.get(path)).body } : null
};
function request(data, headers = {}) {
  return new Request(origin + '/api/briefs', { method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data)
  });
}
const sample = { id: crypto.randomUUID(), mode: 'single', department: 'content', brief: 'Viết một caption.' };
const first = await receiveBrief(request({ ...sample, apiKey: 'never persist', status: 'approved' }), storage);
assert.equal(first.status, 201);
const receipt = await first.json();
assert.deepEqual(await (await receiveBrief(request(sample), storage)).json(), receipt);
assert.equal(rows.size, 1);
assert.ok(![...rows.values()][0].includes('never persist'));
assert.equal((await receiveBrief(request({ ...sample, brief:'Nội dung khác' }), storage)).status,409);
assert.equal((await receiveBrief(request(sample, { Origin:'https://another.example' }), storage)).status,403);
assert.equal((await receiveBrief(new Request(origin+'/api/briefs'), storage)).status,405);
assert.equal((await receiveBrief(request({ ...sample, brief:'  ' }), storage)).status,400);
assert.equal((await receiveBrief(request({ ...sample, department:'unknown' }), storage)).status,400);

const page = await readFile(new URL('../ui.html',import.meta.url),'utf8');
const script = await readFile(new URL('../office-ui.js',import.meta.url),'utf8') + '\n' + page.match(/<script>([\s\S]*?)<\/script>/)[1];
const saved = new Map();
const node = {classList:{toggle(){}},className:'',textContent:'',innerHTML:''};
let statusAccepted = true;
let dropResponse = false;
const app = {
  console,crypto, AbortSignal, setTimeout,clearTimeout,FormData,
  document:{documentElement:{dataset:{briefInbox:'remote'}},getElementById:()=>null,
    querySelector:()=>node,querySelectorAll:()=>[],addEventListener(){}},
  window:{addEventListener(){},scrollTo(){}},
  localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},
  fetch: async (path, options) => {
    if(path==='/api/status') return Response.json({configured:false});
    if(path==='/api/work'){const {id}=JSON.parse(options.body);return Response.json({job:{id,version:1,status:'review',pipeline:['account','content','qa'],outputs:{account:'{}',content:'Đầu ra kiểm thử',qa:'{"passed":true,"issues":[]}'},calls:3,history:[]}});}
    assert.equal(path,'/api/briefs','keyless submissions never call the BYOK generation API');
    if(!statusAccepted) throw new TypeError('offline');
    const result = await receiveBrief(request(JSON.parse(options.body)),storage);
    if(dropResponse) {dropResponse=false;throw new TypeError('response lost');}
    return result.ok ? Response.json({...await result.json(),workToken:"test-only-work-token"},{status:result.status}) : result;
  }
};
vm.createContext(app);
vm.runInContext(script,app);
vm.runInContext("render=()=>{}; toast=()=>{}; openConnection=()=>{throw Error('Unsolicited API key modal');};",app);
for(const department of ['account','strategy','content','creative','performance','qa']){
  app.department=department;
  const order=await vm.runInContext("submitOrder({mode:'single',department,brief:'Kiểm tra giao việc',draftScope:department})",app);
  assert.equal(order.status,'review');
  assert.equal(order.calls,3);
  assert.ok(order.receivedAt);
}
dropResponse=true;
const order=await vm.runInContext("submitOrder({mode:'full',brief:'Bộ sưu tập mới',draftScope:'home'})",app);
assert.equal(order.status,'not_sent');
const rowsBeforeRetry=rows.size;
await vm.runInContext("Promise.all([sendAgencyBrief(state.orders[0]),sendAgencyBrief(state.orders[0])])",app);
assert.equal(order.status,'review');
assert.equal(rows.size,rowsBeforeRetry);
assert.ok(JSON.parse(saved.get('mkt-studio-v1')).orders[0].receivedAt);
statusAccepted=false;
const offline=await vm.runInContext("submitOrder({mode:'full',brief:'Giữ khi offline'})",app);
assert.equal(offline.status,'not_sent');
assert.ok(!offline.receivedAt);
assert.equal(offline.brief,'Giữ khi offline');
console.log('PASS: private keyless intake, receipts, all six scopes, lost-response retries, offline recovery, no public read endpoint.');
