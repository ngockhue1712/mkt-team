/* Home office and scoped brief intake. Existing orders keep their storage format. */
let selectedRoom=null,officeScene=null;
const ROOM_NAMES={account:'Account',strategy:'Strategy',content:'Content',creative:'Creative',performance:'Performance',qa:'QA'};
function pixelPup(){return '<svg class="pixel-pup" viewBox="0 0 32 26" aria-hidden="true" shape-rendering="crispEdges"><path fill="#f9f4e8" d="M11 3h10v3h4v4h3v10h-3v3H8v-3H5V10h3V6h3z"/><path fill="#695a55" d="M6 7h4v5H8v8H3v-3H1v-5h2V9h3zm20 2h3v3h2v7h-5v-3h-2v-5h2z"/><path fill="#695a55" d="M12 14h2v3h-2zm8 0h2v3h-2zm-4 5h3v2h-3z"/><path fill="#d8b3ad" d="M9 18h3v1H9zm12 0h3v1h-3z"/></svg>';}
function orderId(){
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
function ensureDrafts(){if(!state.uiDrafts||typeof state.uiDrafts!=='object'||Array.isArray(state.uiDrafts))state.uiDrafts={};}
function quickDraft(scope){ensureDrafts();const d=state.uiDrafts[scope];return d&&typeof d==='object'?d:{brief:'',deliverables:''};}
function captureQuickDrafts(){
  for(const id of ['quickAgency','quickRoom']){
    const form=document.getElementById(id);const scope=form?.dataset.scope;if(!form||!scope)continue;
    ensureDrafts();state.uiDrafts[scope]=Object.fromEntries(new FormData(form));
  }
}
function roomCounts(){return Object.fromEntries(Object.keys(ROOM_NAMES).map(id=>[id,state.orders.filter(o=>o.status!=='approved'&&(o.mode==='single'?o.department===id:o.pipeline?.includes(id))).length]));}
function extraBriefFields(value,id){return '<details class="quick-details"><summary>Thêm yêu cầu đầu ra cụ thể</summary><div class="field"><label for="'+id+'">Đầu ra cần nhận</label><textarea id="'+id+'" name="deliverables" maxlength="4000" placeholder="VD: 5 caption Facebook, 2 kịch bản video, 1 kế hoạch nội dung…">'+esc(value)+'</textarea></div></details>';}
function officeHome(){
  const d=quickDraft('home'),review=state.orders.filter(o=>['review','qa_failed'].includes(o.status)).length;
  const selected=selectedRoom&&DEPTS[selectedRoom]?selectedRoom:null;
  return '<div class="office-heading"><div><span class="eyebrow">A LITTLE HOME FOR BIG IDEAS</span><h1><span class="title-my">My own</span> <span class="title-agency">AGENCY</span><span class="title-star" aria-hidden="true">✦</span></h1><p>Ghé một phòng để giao việc. Hoặc đưa brief cho cả nhà.</p></div><div class="hello-sticker" aria-hidden="true">'+pixelPup()+'<span>HELLO!<small>your tiny creative team</small></span></div><div class="office-tools">'+(review?'<button class="btn small review-count" data-route="review">'+review+' output chờ duyệt →</button>':'')+'<button class="btn small subtle" data-new>＋ Brief đầy đủ</button></div></div>'+
    '<div class="office-layout '+(selected?'room-open':'')+'"><div class="office-map"><div class="board-note"><span>MY LITTLE OFFICE</span><span>✦ &nbsp; MKT STUDIO &nbsp; ✦</span></div><span class="scrap-star star-one" aria-hidden="true">✦</span><span class="scrap-star star-two" aria-hidden="true">✧</span><span class="scrap-star star-three" aria-hidden="true">✦</span><div class="voxel-stage" id="voxelStage" aria-label="Văn phòng pixel sáu phòng ban và đội ngũ cún AI"></div><div class="room-directory" aria-label="Chọn phòng ban">'+Object.entries(ROOM_NAMES).map(([id,name])=>'<button data-dept="'+id+'" class="'+(id===selected?'active':'')+'" aria-expanded="'+String(id===selected)+'" aria-controls="roomDrawer">'+name+'</button>').join('')+'</div><div class="office-legend"><span><i class="tiny-square"></i>6 phòng AI · Bạn duyệt đầu ra</span><span>Bấm vào phòng để ghé thăm ↗</span></div></div>'+roomDrawer(selected)+'</div>'+
    '<section class="quick-brief" aria-labelledby="agencyBriefHeading"><form id="quickAgency" data-scope="home"><div class="quick-title"><h2 id="agencyBriefHeading">Gửi brief cho agency</h2><small>Account chọn và phối hợp các phòng phù hợp</small></div><div class="quick-entry"><textarea id="homeBrief" name="brief" required maxlength="12000" rows="2" aria-label="Brief chung cho agency" placeholder="Mô tả mục tiêu của bạn… Ví dụ: Lên campaign ra mắt bộ sưu tập tháng 12, hướng đến nữ văn phòng 22–30 tuổi.">'+esc(d.brief)+'</textarea><button type="submit" class="btn primary" '+(busy?'disabled':'')+'>Gửi brief ↗</button></div>'+extraBriefFields(d.deliverables,'homeDeliverables')+intakeNote()+'</form></section>'+
    (state.orders.length?'<div class="section-head"><h2>Order gần đây</h2><button class="btn small" data-route="orders">Xem tất cả →</button></div>'+rows(state.orders.slice(0,3)):'');
}
function roomDrawer(id){
  if(!id)return '<aside id="roomDrawer" hidden></aside>';
  const d=quickDraft(id),dept=DEPTS[id];
  return '<aside class="room-drawer" id="roomDrawer" aria-labelledby="roomTitle"><div class="drawer-head"><div><div class="room-welcome">'+pixelPup()+'<span>WELCOME TO<br>MY LITTLE ROOM</span></div><h2 id="roomTitle">Phòng '+ROOM_NAMES[id]+'</h2><p>'+dept.desc+'</p></div><button type="button" class="close" id="closeRoom" aria-label="Đóng phòng, về tổng quan">×</button></div><form id="quickRoom" data-scope="'+id+'"><label for="roomBrief">Brief của bạn</label><textarea id="roomBrief" name="brief" required maxlength="12000" rows="5" placeholder="'+esc({account:'Chuẩn hóa brief và đề xuất phạm vi công việc cho chiến dịch…',strategy:'Lên chiến lược tiếp cận nhóm khách hàng…',content:'Viết 5 caption giới thiệu bộ sưu tập mới, giọng trẻ trung…',creative:'Đề xuất 3 concept hình ảnh cùng brief thiết kế cho…',performance:'Phân bổ ngân sách 20 triệu cho chiến dịch…',qa:'Rà soát nội dung sau theo brief và brand guideline…'}[id])+'">'+esc(d.brief)+'</textarea>'+extraBriefFields(d.deliverables,'roomDeliverables')+intakeNote()+'<button class="btn primary submit-room" type="submit" '+(busy?'disabled':'')+'>Giao cho '+ROOM_NAMES[id]+' ↗</button></form><div class="room-route"><span>Nhận brief</span><span>→ '+ROOM_NAMES[id]+' thực hiện</span><span>→ Kiểm tra</span><b>→ Bạn duyệt</b></div></aside>';
}
function openRoom(id){
  if(!DEPTS[id]||!Object.hasOwn(ROOM_NAMES,id))return;
  captureQuickDrafts();if(route==='new')captureForm();save();route='home';selectedRoom=id;render();
  document.getElementById('roomBrief')?.focus({preventScroll:true});
  if(window.matchMedia?.('(max-width:850px)').matches)document.getElementById('roomDrawer')?.scrollIntoView({block:'start',behavior:'smooth'});
}
function initOffice(){
  const host=document.getElementById('voxelStage');if(!host)return;
  if(window.VoxelOffice){officeScene=new window.VoxelOffice(host,{onSelect:openRoom,selected:selectedRoom,counts:roomCounts()});}
  else {host.innerHTML='<div class="hint">Chọn phòng ban bên dưới để giao việc.</div>';document.querySelector('.room-directory')?.style.setProperty('display','flex');}
}
const pendingBriefs = new Set();
function hasAgencyInbox() {
  return document.documentElement?.dataset?.briefInbox === 'remote';
}
function intakeNote() {
  return hasAgencyInbox() ? '<p class="muted intake-note">Brief được gửi đến hộp nhận riêng của agency. Các phòng sẽ thực hiện và gửi bản bàn giao để bạn duyệt.</p>' : '';
}
function intakePanel(order) {
  if (!hasAgencyInbox()) return '';
  const destination = order.mode === 'single' ? 'phòng ' + ROOM_NAMES[order.department] : 'toàn agency';
  if (order.engine==='office' && ['review','approved'].includes(order.status)) return '';
  if (order.receivedAt) {
    return '<section class="panel intake-receipt" aria-label="Biên nhận brief"><h2>Agency đã nhận brief</h2><p>Đã gửi đến ' +
      esc(destination) + ' lúc ' + esc(new Date(order.receivedAt).toLocaleString('vi-VN')) +
      '.</p><small>Mã brief · ' + esc(order.id) + '</small>' +
      (order.status === 'received' ? '<p>Brief đã sẵn sàng để các phòng thực hiện.</p><button class="btn primary" id="runOffice">Thực hiện brief này</button>' :
        order.engine==='office' && order.status==='running' ? '<p role="status">Đang thực hiện · '+esc(DEPTS[order.runningRole]?.name||'Account')+(order.runningRole==='content' && order.captions?.length?' · Đã viết '+order.captions.length+' caption':'')+'. Kết quả từng phòng sẽ được lưu sau khi hoàn tất.</p>' : '') + '</section>';
  }
  if (order.status === 'sending_brief') return '<div class="hint" role="status">Đang gửi brief đến agency…</div>';
  if (order.status === 'draft' || order.status === 'not_sent' || order.status === 'error') {
    return '<section class="panel intake-receipt"><h2>Brief chưa gửi</h2><p>' +
      esc(order.intakeError || 'Brief hiện nằm trên thiết bị này. Gửi để agency nhận được yêu cầu.') +
      '</p><button type="button" class="btn primary small" id="sendBriefAgain">Gửi brief cho agency</button></section>';
  }
  return '';
}
async function sendAgencyBrief(order) {
  if (pendingBriefs.has(order.id) || order.receivedAt) return;
  pendingBriefs.add(order.id);
  order.status = 'sending_brief';
  order.error = null;
  order.intakeError = '';
  save();
  if (activeId === order.id) render();
  let received = false;
  try {
    const fields = ['id','mode','department','title','brief','deliverables','deadline','budget','reference','brand'];
    const payload = Object.fromEntries(fields.map(key => [key, order[key]]));
    const response = await fetch('/api/briefs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(30000)
    });
    const receipt = await response.json();
    if (!response.ok) throw new Error(receipt.error || 'Chưa nhận được biên nhận.');
    if (receipt.id !== order.id || !Number.isFinite(Date.parse(receipt.receivedAt))) throw new Error('Biên nhận không hợp lệ.');
    order.receivedAt = receipt.receivedAt;
    order.status = 'received';
    received = true;
  } catch (error) {
    order.status = 'not_sent';
    order.intakeError = 'Chưa xác nhận gửi thành công. Bạn có thể gửi lại cùng mã brief.';
    if (error.name === 'TypeError' || error.name === 'TimeoutError') order.intakeError += ' Hãy kiểm tra kết nối mạng.';
  } finally {
    pendingBriefs.delete(order.id);
    save();
    if (activeId === order.id) render();
  }
  if (received) {
    toast('Agency đã nhận brief ' + order.id.slice(0, 8).toUpperCase() + '.');
    if (!busy) {
      if (apiKey || serverConfigured) await execute(order);
      else await runOfficeOrder(order);
    }
  }
}
async function copyForChat(order) {
  const task = order.mode === 'single' ? 'Thực hiện order cho phòng ' + ROOM_NAMES[order.department] :
    'Phân công các phòng liên quan và thực hiện order marketing';
  const prompt = task + '. Tạo các đầu ra được giao, ghi rõ giả định, kiểm tra theo brief và để khách hàng duyệt.\n\n' + briefContext(order);
  try {
    await navigator.clipboard.writeText(prompt);
    toast('Đã sao chép. Dán yêu cầu vào ChatGPT để xử lý brief.');
  } catch {
    toast('Có thể dùng nút Xuất bàn giao để tải brief.');
  }
}

async function submitOrder(values){
  if(busy){toast('Agency đang xử lý một order. Bạn có thể soạn brief tiếp theo.');return;}
  const brief=String(values.brief||'').trim();if(!brief){toast('Nhập brief trước khi giao việc.');return;}
  if(values.mode==='single'&&!Object.hasOwn(ROOM_NAMES,values.department)){toast('Chọn phòng ban hợp lệ.');return;}
  const o={...values,title:String(values.title||brief.split(/\n/)[0]).slice(0,150),brief,deliverables:String(values.deliverables||'Thực hiện các đầu ra được yêu cầu trong brief. Nếu phạm vi đầu ra chưa rõ, hỏi khách hàng trước khi thực hiện.'),deadline:values.deadline||'',budget:values.budget||'',reference:values.reference||'',id:orderId(),created:new Date().toISOString(),brand:{...state.brand},status:hasAgencyInbox()?'sending_brief':'draft',outputs:{},history:[],pipeline:['account'],calls:0,error:null};
  state.orders.unshift(o);captureQuickDrafts();save();activeId=o.id;activeTab=hasAgencyInbox()?'brief':'account';route='detail';render();if(values.draftScope&&state.uiDrafts){delete state.uiDrafts[values.draftScope];save();}window.scrollTo({top:0,behavior:'smooth'});if(hasAgencyInbox()) await sendAgencyBrief(o);
  else if(apiKey || serverConfigured) await execute(o);
  return o;
}
function bindOffice(){
  for(const [id,scope] of [['quickAgency','home'],['quickRoom',selectedRoom]]){
    const form=document.getElementById(id);if(!form||!scope)continue;
    form.oninput=()=>{captureQuickDrafts();save();};
    form.onsubmit=async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(form));await submitOrder({...values,mode:scope==='home'?'full':'single',department:scope==='home'?'content':scope,draftScope:scope});};
  }
  const close=document.getElementById('closeRoom');if(close)close.onclick=()=>{const old=selectedRoom;captureQuickDrafts();save();selectedRoom=null;render();document.querySelector('[data-voxel-room="'+old+'"]')?.focus({preventScroll:true});};
  initOffice();
}
function workRole(department){return department==='account'?'account_work':department==='qa'?'qa_work':department;}

function outcomePanel(order) {
  if (order.engine !== 'office' || !order.outputs.qa || !['review','approved'].includes(order.status)) return '';
  const roles = order.pipeline.filter(key => key !== 'account' && key !== 'qa');
  const qa = JSON.parse(order.outputs.qa);
  const issues = (qa.issues || []).map(item=>'<li>'+esc(item.issue)+'</li>').join('');
  return '<section class="panel delivery" aria-label="Bản bàn giao"><span class="eyebrow">BÀN GIAO · PHIÊN BẢN '+(order.version || 1)+'</span>' +
    '<h2>'+(order.status==='approved'?'Bản bạn đã duyệt':'Bản cuối chờ bạn duyệt')+'</h2>'+
    roles.map(key=>'<article><h3>'+esc(DEPTS[key].name)+'</h3><div class="delivery-text">'+esc(order.outputs[key])+'</div></article>').join('')+
    '<details class="delivery-qa"'+(issues?' open':'')+'><summary>QA · '+(issues?'Có góp ý trước khi sử dụng':'Đã rà soát')+'</summary><p>'+esc(qa.summary)+'</p>'+(issues?'<ul>'+issues+'</ul>':'')+'</details>'+
    (order.status==='approved'?'<p class="hint">Bạn đã duyệt bản này.</p>':'<button class="btn primary" id="approveDelivery">Duyệt bản này</button>')+
    '<details class="delivery-feedback"><summary>Yêu cầu chỉnh sửa</summary><label for="deliveryFeedback">Bạn muốn sửa phần nào?</label><textarea id="deliveryFeedback" maxlength="5000" placeholder="VD: Rút ngắn caption thứ hai và đổi lời kêu gọi hành động."></textarea><button class="btn small" id="reviseDelivery">Gửi phản hồi</button></details></section>';
}

function applyOfficeResult(order, job) {
  if (job.id !== order.id || !job.outputs || !Array.isArray(job.pipeline)) throw Error('Không đọc được bản bàn giao.');
  for (const key of ['outputs','pipeline','status','calls','runningRole','version','approvedAt','error','captions']) order[key]=job[key];
  order.engine='office';
  order.history=(job.history||[]).flatMap(version=>Object.entries(version.outputs).map(([role,output])=>({role,output,at:version.approvedAt||order.created})));
  if(job.outputs.qa) order.qaPassed=JSON.parse(job.outputs.qa).passed===true;
}

async function runOfficeOrder(order, action='advance', feedback='') {
  if (busy || !order?.receivedAt) return;
  busy=true;
  order.engine='office';
  order.error=null;
  if(action==='advance') {order.status='running';order.runningRole=order.pipeline.find(k=>!order.outputs[k])||'account';}
  save();render();
  try {
    let next=action;
    while(true) {
      const response=await fetch('/api/work',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id:order.id,action:next,feedback,version:order.version||1}),signal:AbortSignal.timeout(310000)
      });
      const body=await response.json().catch(()=>null);
      if(!response.ok || !body?.job)throw Error(body?.error || 'Kết nối bị ngắt. Có thể tiếp tục từ bước đã lưu.');
      applyOfficeResult(order,body.job);save();
      if(activeId===order.id){activeTab=order.runningRole||order.pipeline[1]||'brief';render();}
      if(order.status!=='running')break;
      if(response.status===202)await new Promise(resolve=>setTimeout(resolve,8500));
      next='advance';
    }
    if(order.status==='review')toast('Các phòng đã bàn giao. Mời bạn xem và duyệt.');
    if(order.status==='approved')toast('Đã lưu quyết định duyệt.');
  } catch(error) {
    order.status='error';order.runningRole=null;order.error=error.message;
  } finally {
    busy=false;save();if(activeId===order.id)render();
  }
}
