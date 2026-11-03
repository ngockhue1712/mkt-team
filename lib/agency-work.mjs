import { randomUUID } from 'node:crypto';
const rooms = ['strategy','content','creative','performance'];
const workRole = {account:'account_work',qa:'qa_work'};
const text = {type:'string'};
const list = {type:'array',items:text,minItems:1,maxItems:4};
const roles = {
  account: 'Bạn là Account của agency. Đọc brief và tóm tắt nhiệm vụ thực tế bằng tiếng Việt. Ghi đúng sản phẩm, đối tượng, số lượng, các ràng buộc và tiêu chí giao hàng. Không bịa dữ kiện.',
  strategy: 'Bạn là giám đốc chiến lược marketing. Dựa vào brief lập hướng tiếp cận dùng được, nêu chân dung khách, thông điệp, kênh, giai đoạn và KPI đề xuất. Trả lời tiếng Việt.',
  content: 'Bạn là copywriter Việt Nam. Viết toàn bộ nội dung mà khách đặt, đủ số lượng. Viết nội dung đăng được ngay, đúng giọng thương hiệu, CTA và yêu cầu ảnh nếu có. Không thêm giá, tính năng hay ưu đãi chưa có trong brief.',
  creative: 'Bạn là art director. Viết bản đặc tả thiết kế cụ thể bằng tiếng Việt cho từng sản phẩm được yêu cầu: ý tưởng hình ảnh, bố cục, màu, dòng chữ, cảnh quay hoặc shot list. Đây là bản mô tả thiết kế.',
  performance: 'Bạn là chuyên viên performance. Tạo media plan bằng tiếng Việt theo brief: ngân sách nếu có, kênh, mục tiêu, lịch và phương án test. Nêu rõ giả định. Không bịa kết quả.',
  account_work: 'Bạn là Account Manager. Tạo trực tiếp tài liệu mà khách yêu cầu: phạm vi công việc, nội dung brief chuẩn hóa, mốc bàn giao và tiêu chí duyệt. Viết bằng tiếng Việt.',
  qa_work: 'Bạn là biên tập viên QA. Đọc tài liệu khách gửi và viết báo cáo bằng tiếng Việt: vấn đề cụ thể, trích dẫn, cách sửa, mục chưa đủ căn cứ và checklist.',
  qa: 'Bạn là người kiểm tra độc lập. Đối chiếu các sản phẩm đã viết với yêu cầu gốc. Kiểm tra số lượng, độ dài, giọng và ràng buộc. Viết tiếng Việt. Nếu còn thiếu, ghi rõ trong warnings. Không tự duyệt thay khách.'
};
const accountSchema={type:'object',properties:{summary:text,acceptance:list},required:['summary','acceptance']};
const qaSchema={type:'object',properties:{summary:text,warnings:{type:'array',items:text,maxItems:4}},required:['summary','warnings']};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function read(storage,path) {
  const result=await storage.get(path,{access:'private',useCache:false});
  if (!result || result.statusCode!==200) return null;
  return {data:await new Response(result.stream).json(),etag:result.blob.etag};
}
function publicState(job) {
  const { lease, ...view }=job;
  return view;
}
function initialJob(brief) {
  const specialists=brief.mode==='single' ? [workRole[brief.department] || brief.department] : rooms;
  return {id:brief.id,version:1,status:'running',pipeline:['account',...specialists,'qa'],outputs:{},calls:0,feedback:'',history:[],runningRole:'account'};
}
function handoff(brief,job) {
  const brand=Object.values(brief.brand || {}).filter(Boolean).join(' · ');
  const inputs=[brief.brief,brief.deliverables,brand,brief.deadline,brief.budget,brief.reference,job.feedback].filter(Boolean);
  const previous=job.pipeline.filter(k=>job.outputs[k]).map(k=> k.toUpperCase()+'\n'+job.outputs[k].slice(0,2300));
  return 'BRIEF\n'+inputs.map(s=>s.slice(0,4500)).join('\n')+'\n\nBÀN GIAO TỪ PHÒNG TRƯỚC\n'+previous.join('\n\n');
}
async function produce(brief,job,role,infer) {
  const prompt=handoff(brief,job);
  let instruction=roles[role], limit=800;
  if(role==='account'){instruction+=' Chỉ trả lời bằng một câu tiếng Việt nêu nhiệm vụ bàn giao cụ thể, tối đa 35 từ.';limit=80;}
  if(role==='qa'){instruction+=' Trả lời một câu bắt đầu bằng ĐẠT hoặc CẦN SỬA và lý do cụ thể, tối đa 45 từ.';limit=110;}
  const raw=await infer({system:instruction,prompt,maxTokens:limit});
  if (!raw?.trim()) throw Error('empty_deliverable');
  if (role==='account') return JSON.stringify({summary:raw.trim(),acceptance:[brief.deliverables || brief.brief],departments:job.pipeline.slice(1,-1),questions:[],needs_clarification:false});
  if (role==='qa'){
    const passed=/^\s*(?:[\*#-]+\s*)?(?:đạt|pass)\b/iu.test(raw.trim());
    const issues=passed?[]:[{department:job.pipeline[1],issue:raw.trim(),fix:'Xem góp ý và yêu cầu chỉnh sửa khi cần.'}];
    return JSON.stringify({summary:raw.trim(),passed,issues,checklist:[{criterion:'Đối chiếu đầu ra với brief',passed}]});
  }
  if (!raw?.trim()) throw Error('empty_deliverable');
  return raw.trim();
}

export async function runAgencyRequest(request,{storage,infer}) {
  const origin=new URL(request.url).origin;
  if (request.method!=='POST' || request.headers.get('origin')!==origin) return reply({error:'Yêu cầu không hợp lệ.'},403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({error:'Cần dữ liệu JSON.'},415);
  const raw=await request.text();
  if(raw.length>7200)return reply({error:'Yêu cầu quá dài.'},413);
  let input;try{input=JSON.parse(raw);}catch{return reply({error:'Yêu cầu không hợp lệ.'},400);}
  if (!uuid.test(input?.id) || !['advance','status','approve','revise'].includes(input.action)) return reply({error:'Order không hợp lệ.'},400);
  const id=input.id.toLowerCase(),path='outcomes/'+id+'.json';
  const receipt=await read(storage,'briefs/'+id+'.json');
  if (!receipt) return reply({error:'Không tìm thấy biên nhận của order.'},404);
  const brief=receipt.data.brief;
  let prior=await read(storage,path);
  const job=prior?.data || initialJob(brief);
  const save=async()=>{
    const options = prior ? {allowOverwrite:true,ifMatch:prior.etag} : {allowOverwrite:false};
    try{
      const saved=await storage.put(path,JSON.stringify(job),{access:'private',addRandomSuffix:false,contentType:'application/json',...options});
      prior={etag:saved.etag};return true;
    }catch(error){if(error.name==='BlobPreconditionFailedError'||/already exists|precondition|etag/i.test(error.message))return false;throw error;}
  };
  const conflict=async()=>reply({job:publicState((await read(storage,path)).data)},202);
  if(input.action==='status')return reply({job:publicState(job)});
  if (job.lease && job.lease.expires>Date.now()) return reply({job:publicState(job)},202);
  if(input.action==='approve'){
    if(job.status==='approved')return reply({job:publicState(job)});
    if(job.status!=='review'||!job.outputs.qa)return reply({error:'Chưa có bản bàn giao để duyệt.'},409);
    job.status='approved';job.approvedAt=new Date().toISOString();return await save()?reply({job:publicState(job)}):conflict();
  }
  if(input.action==='revise'){
    if(!['review','approved'].includes(job.status)||typeof input.feedback!=='string'||!input.feedback.trim()||input.feedback.length>5000)return reply({error:'Nhập phản hồi trên bản đã bàn giao.'},400);
    if(job.version>=5)return reply({error:'Order đã có 5 phiên bản. Hãy mở order mới cho yêu cầu tiếp theo.'},409);
    job.history.push({version:job.version,outputs:job.outputs,approvedAt:job.approvedAt||null});
    job.outputs={};job.feedback=input.feedback.trim();job.version++;job.status='running';job.approvedAt=null;job.runningRole='account';job.error=null;
    return await save()?reply({job:publicState(job)}):conflict();
  }
  if(['review','approved'].includes(job.status))return reply({job:publicState(job)});
  const role=job.pipeline.find(step=>!job.outputs[step]);
  if(!role)return reply({error:'Order thiếu thông tin bàn giao.'},409);
  job.status='running';job.runningRole=role;job.error=null;job.lease={token:randomUUID(),expires:Date.now()+297000};
  if (!await save())return conflict();
  try{
    job.outputs[role]=await produce(brief,job,role,infer);job.calls++;
    job.runningRole=job.pipeline.find(step=>!job.outputs[step])||null;
    job.status=job.runningRole?'running':'review';
  }catch(e){
    const diagnostic=String(e?.message||e?.name||'').slice(0,400);
    console.warn('department_engine',role,diagnostic.replace(/https?:\/\/\S+/g,'[url]'));
    job.status='error';job.error='Phòng '+role+' chưa tạo xong đầu ra. Có thể tiếp tục từ bước này.';job.runningRole=null;
  }
  delete job.lease;
  return await save()?reply({job:publicState(job)}):conflict();
}
