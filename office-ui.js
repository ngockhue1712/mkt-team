/* Home office and scoped brief intake. Existing orders keep their storage format. */
let selectedRoom=null,officeScene=null;
const ROOM_NAMES={account:'Account',strategy:'Strategy',content:'Content',creative:'Creative',performance:'Performance',qa:'QA'};
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
  return '<div class="office-heading"><div><span class="eyebrow">YOUR AI OFFICE</span><h1>Văn phòng của bạn</h1><p>Ghé một phòng để giao việc. Hoặc đưa brief cho cả agency.</p></div><div class="office-tools">'+(review?'<button class="btn small review-count" data-route="review">'+review+' output chờ duyệt →</button>':'')+'<button class="btn small subtle" data-new>＋ Brief đầy đủ</button></div></div>'+
    '<div class="office-layout '+(selected?'room-open':'')+'"><div class="office-map"><div class="voxel-stage" id="voxelStage" aria-label="Văn phòng voxel sáu phòng ban"></div><div class="room-directory" aria-label="Chọn phòng ban">'+Object.entries(ROOM_NAMES).map(([id,name])=>'<button data-dept="'+id+'" class="'+(id===selected?'active':'')+'" aria-expanded="'+String(id===selected)+'" aria-controls="roomDrawer">'+name+'</button>').join('')+'</div><div class="office-legend"><span><i class="tiny-square"></i>6 phòng AI · Bạn duyệt đầu ra</span><span>Bấm bảng tên hoặc sàn phòng để giao việc ↗</span></div></div>'+roomDrawer(selected)+'</div>'+
    '<section class="quick-brief" aria-labelledby="agencyBriefHeading"><form id="quickAgency" data-scope="home"><div class="quick-title"><h2 id="agencyBriefHeading">Gửi brief cho agency</h2><small>Account chọn và phối hợp các phòng phù hợp</small></div><div class="quick-entry"><textarea id="homeBrief" name="brief" required maxlength="12000" rows="2" aria-label="Brief chung cho agency" placeholder="Mô tả mục tiêu của bạn… Ví dụ: Lên campaign ra mắt bộ sưu tập tháng 12, hướng đến nữ văn phòng 22–30 tuổi.">'+esc(d.brief)+'</textarea><button type="submit" class="btn primary" '+(busy?'disabled':'')+'>Gửi brief ↗</button></div>'+extraBriefFields(d.deliverables,'homeDeliverables')+'</form></section>'+
    (state.orders.length?'<div class="section-head"><h2>Order gần đây</h2><button class="btn small" data-route="orders">Xem tất cả →</button></div>'+rows(state.orders.slice(0,3)):'');
}
function roomDrawer(id){
  if(!id)return '<aside id="roomDrawer" hidden></aside>';
  const d=quickDraft(id),dept=DEPTS[id];
  return '<aside class="room-drawer" id="roomDrawer" aria-labelledby="roomTitle"><div class="drawer-head"><div><span class="dept-icon">'+dept.icon+'</span><h2 id="roomTitle">Phòng '+ROOM_NAMES[id]+'</h2><p>'+dept.desc+'</p></div><button type="button" class="close" id="closeRoom" aria-label="Đóng phòng, về tổng quan">×</button></div><form id="quickRoom" data-scope="'+id+'"><label for="roomBrief">Brief của bạn</label><textarea id="roomBrief" name="brief" required maxlength="12000" rows="5" placeholder="'+esc({account:'Chuẩn hóa brief và đề xuất phạm vi công việc cho chiến dịch…',strategy:'Lên chiến lược tiếp cận nhóm khách hàng…',content:'Viết 5 caption giới thiệu bộ sưu tập mới, giọng trẻ trung…',creative:'Đề xuất 3 concept hình ảnh cùng brief thiết kế cho…',performance:'Phân bổ ngân sách 20 triệu cho chiến dịch…',qa:'Rà soát nội dung sau theo brief và brand guideline…'}[id])+'">'+esc(d.brief)+'</textarea>'+extraBriefFields(d.deliverables,'roomDeliverables')+'<button class="btn primary submit-room" type="submit" '+(busy?'disabled':'')+'>Giao cho '+ROOM_NAMES[id]+' ↗</button></form><div class="room-route"><span>Nhận brief</span><span>→ '+ROOM_NAMES[id]+' thực hiện</span><span>→ Kiểm tra</span><b>→ Bạn duyệt</b></div></aside>';
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
async function submitOrder(values){
  if(busy){toast('Agency đang xử lý một order. Bạn có thể soạn brief tiếp theo.');return;}
  const brief=String(values.brief||'').trim();if(!brief){toast('Nhập brief trước khi giao việc.');return;}
  if(values.mode==='single'&&!Object.hasOwn(ROOM_NAMES,values.department)){toast('Chọn phòng ban hợp lệ.');return;}
  const o={...values,title:String(values.title||brief.split(/\n/)[0]).slice(0,150),brief,deliverables:String(values.deliverables||'Thực hiện các đầu ra được yêu cầu trong brief. Nếu phạm vi đầu ra chưa rõ, hỏi khách hàng trước khi thực hiện.'),deadline:values.deadline||'',budget:values.budget||'',reference:values.reference||'',id:orderId(),created:new Date().toISOString(),brand:{...state.brand},status:'draft',outputs:{},history:[],pipeline:['account'],calls:0,error:null};
  state.orders.unshift(o);captureQuickDrafts();save();activeId=o.id;activeTab='account';route='detail';render();if(values.draftScope&&state.uiDrafts){delete state.uiDrafts[values.draftScope];save();}window.scrollTo({top:0,behavior:'smooth'});await execute(o);return o;
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
