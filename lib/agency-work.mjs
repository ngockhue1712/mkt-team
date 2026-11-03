import { randomUUID } from 'node:crypto';
const rooms = ['strategy','content','creative','performance'];
const workRole = {account:'account_work',qa:'qa_work'};
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
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function read(storage,path) {
  // Read immutable receipts directly. For a mutable checkpoint use the write API's
  // canonical ETag, not the potentially weak ETag of a compressed CDN response.
  const mutable=path.startsWith('outcomes/') && storage.head;
  for(let attempt=0;attempt<3;attempt++){
    let metadata;
    if(mutable){
      try{metadata=await storage.head(path);}
      catch(error){if(error.name==='BlobNotFoundError'||/not found|does not exist/i.test(error.message))return null;throw error;}
    }
    const result=await storage.get(path,{access:'private',useCache:false});
    if(!result || result.statusCode!==200)return null;
    const data=await new Response(result.stream).json();
    if(!mutable)return {data,etag:result.blob.etag};
    if((await storage.head(path)).etag===metadata.etag)return {data,etag:metadata.etag};
  }
  throw Error('Checkpoint changed during read');
}
function publicState(job) {
  const { lease, ...view }=job;
  return view;
}
function initialJob(brief) {
  const specialists=brief.mode==='single' ? [workRole[brief.department] || brief.department] : rooms;
  return {id:brief.id,version:1,status:'running',pipeline:['account',...specialists,'qa'],outputs:{},calls:0,feedback:'',history:[],runningRole:'account'};
}
function briefText(brief,job) {
  const values = [brief.brief, brief.deliverables?.startsWith('Thực hiện các đầu ra được yêu cầu') ? '' : brief.deliverables,
    Object.values(brief.brand || {}).filter(Boolean).join(' · '),brief.deadline,brief.budget,brief.reference,
    job.feedback ? 'Phản hồi mới nhất của khách: '+job.feedback : ''];
  return values.filter(Boolean).map(value=>value.slice(0,4500)).join('\n');
}

function references(job) {
  return job.pipeline.filter(k=>k!=='qa' && job.outputs[k]).map(k=>{
    const note=k==='account'?JSON.parse(job.outputs.account).summary:job.outputs[k];
    return k.toUpperCase()+': '+note.slice(0,2000);
  }).join('\n');
}

function captionSpec(brief) {
  const request=brief.brief+' '+(brief.deliverables||'');
  const count=request.match(/(?:^|[^\d])(\d{1,2})\s*(?:bài\s+)?captions?\b/i);
  if(!count || +count[1]<1 || +count[1]>12)return null;
  const range=request.match(/(\d{1,3})\s*(?:[-–—]|đến)\s*(\d{1,3})\s*(?:chữ|từ|words?)/i);
  const phases=[...request.matchAll(/(?:một|1)\s+bài\s+([^,.!\n]+?)(?=,|\s+và\s+(?:một|1)\s+bài|[.!\n]|$)/giu)].map(m=>m[1].trim());
  return {count:+count[1],min:range?+range[1]:0,max:range?+range[2]:0,phases,photo:/gợi ý ảnh|ý tưởng ảnh|ảnh chụp|photo idea/i.test(request)};
}

function checkCaption(draft,spec,source) {
  const body=draft.split(/(?:^|\n)\s*(?:[\*#]+\s*)?(?:gợi ý (?:hình )?ảnh|hình ảnh|ảnh|photo)\s*[:：]/i)[0].trim();
  const words=body.split(/\s+/).filter(Boolean).length;
  const issues=[];
  if(spec.min && (words<spec.min||words>spec.max))issues.push('Độ dài '+words+' từ; yêu cầu '+spec.min+'–'+spec.max+' từ.');
  const contacts=draft.match(/(?:https?:\/\/[^\s]+|(?:\+?\d[\s.-]?){9,14}\d)/g)||[];
  if(contacts.some(item=>!source.includes(item.trim())))issues.push('Có thông tin liên hệ không được cung cấp.');
  if(/nhắn tin|inbox/i.test(source)&&!/nhắn tin|gửi tin nhắn|inbox/i.test(body))issues.push('Cần lời mời nhắn tin rõ ràng.');
  if(spec.photo && body===draft.trim())issues.push('Thiếu dòng gợi ý ảnh.');
  return issues;
}

function editToBrief(value,source) {
  let line=value.trim();
  const voice=source.match(/xưng\s*[“"‘']?(tụi mình|chúng mình|bọn mình|chúng tôi|mình|em)(?=[”"’'\s,.;!?]|$)/iu)?.[1];
  if(voice)line=line.replace(/chúng tôi|chúng ta|chúng mình|tụi mình|bọn mình/giu,m=>m[0]===m[0].toUpperCase()?voice[0].toUpperCase()+voice.slice(1):voice);
  const prohibitOffer=/(?:tránh|không|đừng)[^.!?…\n]{0,100}(?:ưu đãi|giảm giá|khuyến m[ãạ]i|discount)/iu.test(source);
  if(prohibitOffer){
    line=line.replace(/\s+(?:để|được|và|sẽ|kèm|với)\s+(?:(?:được|nhận|hưởng|mức|nhiều|những|các)\s+)*(?:ưu đãi|giảm giá|khuyến m[ãạ]i)[^.!?…]*/giu,'');
    if(/ưu đãi|giảm giá|khuyến m[ãạ]i|giá chỉ/iu.test(line))return '';
  }
  if(/nhắn tin|inbox/iu.test(source) && !/(?:gọi điện|điện thoại để)/iu.test(source)) {
    line=line.replace(/liên hệ(?: ngay)? với|gọi(?: ngay)? (?:cho\s+)?/giu,m=>m.endsWith(' ')?'nhắn tin cho ':'nhắn tin cho');
  }
  return line.replace(/^(?:Chào (?:các )?bạn(?: sinh viên)?|Các bạn thân mến)\s*,\s*/iu,'')
    .replace(/^mình muốn mở đặt trước/iu, (voice||'Tiệm')+' mở đặt trước')
    .replace(/\s+([,.!?])/g,'$1').trim();
}
function requestedCTA(source) {
  const match=source.match(/để\s+(?:khách(?: hàng)?|mọi người)\s+(nhắn tin[^.!?…\n]{1,100})/iu);
  if(!match)return '';
  const phrase=match[1].trim();return phrase[0].toUpperCase()+phrase.slice(1)+'.';
}
function editStoredCaptions(brief,job) {
  const spec=captionSpec(brief);
  if(!spec || !job.outputs.content || job.captions?.length!==spec.count)return false;
  const source=briefText(brief,job), old=job.outputs.content;
  for(const item of job.captions){
    const [draft,shot]=item.text.split(/\nẢnh:\s*/u);
    const lines=copySentences(draft,source);
    if(!lines.some(s=>/nhắn tin|gửi tin nhắn|inbox/i.test(s)) && requestedCTA(source))lines.push(requestedCTA(source));
    const body=editCaption(lines,spec.min||32,spec.max||105,/nhắn tin|inbox/i.test(source));
    if(body)item.text=body+(shot?'\nẢnh: '+shot:'');
    item.issues=checkCaption(item.text,spec,source);
  }
  job.outputs.content=job.captions.map((c,i)=>'Caption '+(i+1)+' · '+c.phase+'\n\n'+c.text).join('\n\n');
  return old!==job.outputs.content;
}

function copySentences(raw, source) {
  return raw.replace(/```(?:json)?/gi,'').split(/\n+|(?<=[.!?…])\s+/u)
    .map(s=>s.replace(/^\s*(?:caption\s*\d+|bài\s*\d+|nội dung|chú thích)\s*[:：.-]?\s*/i,'')
      .replace(/^\s*[-*"“”]+|["“”*]+\s*$/g,'').trim())
    .map(s=>editToBrief(s,source))
    .filter(s=>s && !/^[\[\]{},]|^(?:ảnh|gợi ý ảnh|caption|here is|dưới đây|lưu ý)\s*[:：]/i.test(s) &&
      !s.includes('":') && !s.endsWith(':') &&
      !(s.match(/https?:\/\/[^\s]+|(?:\+?\d[\s.()-]?){7,14}\d/g)||[]).some(item=>!source.includes(item)));
}
const wordCount=s=>s.trim().split(/\s+/).filter(Boolean).length;

function editCaption(sentences, min, max, requireMessage) {
  const unique=Array.from(new Map(sentences.map(s=>[s.toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}]/gu,''),s])).values());
  const isCTA=s=>/nhắn tin|inbox|gửi tin nhắn/i.test(s);
  const cta=requireMessage?unique.filter(isCTA).sort((a,b)=>a.length-b.length)[0]:null;
  const pool=cta?unique.filter(s=>!isCTA(s)):unique;
  const allowance=max-(cta?wordCount(cta):0);
  const chosen=[];let words=0;
  for(const line of pool) {
    const size=wordCount(line);
    if(size<3 || size+words>allowance)continue;
    if(chosen.some(s=>s.toLowerCase().slice(0,26)===line.toLowerCase().slice(0,26)))continue;
    chosen.push(line);words+=size;
  }
  if(cta)chosen.push(cta);
  return chosen.join(' ').trim();
}

function reopenIncompleteCaption(brief,job){
  const spec=captionSpec(brief);
  if(!spec || job.autoCopyPass || !job.captions?.length)return false;
  const index=job.captions.findIndex(c=>c.issues?.length);
  if(index<0)return false;
  job.autoCopyPass=true;
  const [body,shot]=job.captions[index].text.split(/\nẢnh:\s*/);
  job.drafting={sentences:copySentences(body,briefText(brief,job)),tries:1,body:'',shot:shot||''};
  job.captions=job.captions.slice(0,index);
  delete job.outputs.content;delete job.outputs.qa;
  job.runningRole='content';job.status='running';
  return true;
}
async function captionPart(brief, job, spec, infer) {
  job.captions ||= [];
  const n=job.captions.length+1;
  const phase=spec.phases[n-1]||'bài đăng '+n;
  const source=briefText(brief,job);
  const facts=brief.brief.replace(/\d{1,2}\s*(?:bài\s+)?captions?/gi,'một bài viết').split(/Cho mình một bài viết, mỗi caption/i)[0];
  const part=job.drafting ||= {sentences:[],tries:0,body:'',shot:''};
  const min=spec.min||32, max=spec.max||105;
  if(!part.body){
    const prompt=[
      'Dữ kiện khách cung cấp: '+facts,
      'Giọng thương hiệu: '+(brief.brand?.voice||'như lời người bán nói với khách'),
      'Account bàn giao: '+JSON.parse(job.outputs.account).summary,
      'Mục đích của bài này: '+phase+'. '+(job.feedback||''),
      job.captions.length?'Đừng lặp lại câu mở sau: '+job.captions.at(-1).text.slice(0,80):'',
      part.tries?'Chỉ viết thêm đoạn GIỮA gồm ba câu mới về tình huống sử dụng sản phẩm trong đời thường của khách. Không chào hỏi, không lặp câu mở hay CTA đã có. Bài đã có các câu này:\n'+part.sentences.join(' '):'Chỉ viết MỘT đoạn Facebook khoảng '+min+'–'+max+' từ bằng tiếng Việt. Có câu mở, chi tiết về sản phẩm, lời mời hành động.',
      'Viết đoạn văn đăng được ngay. Dùng đúng đại từ khách yêu cầu. Không viết tiêu đề, số thứ tự, JSON, hướng dẫn chụp ảnh hoặc thông tin liên lạc không có trong dữ kiện.'
    ].filter(Boolean).join('\n');
    const expansion=part.tries ? 'Khách hàng mục tiêu và sản phẩm: '+facts+'\nĐây là bản đăng đang viết: '+part.sentences.join(' ').slice(0,1000)+'\nViết riêng 3 câu MỚI để đặt vào GIỮA bài này. Mô tả một khoảnh khắc người đọc có thể dùng sản phẩm trong đời thường. Dùng hình ảnh cụ thể, không mở đầu bằng lời chào, không lặp lời mời mua, không thêm giá hay ưu đãi. Chỉ trả về đoạn giữa.' : prompt;
    const raw=await infer({system:'Bạn là copywriter. Trả lời duy nhất bằng lời thương hiệu sẽ đăng trên Facebook.',prompt:expansion,maxTokens:Math.min(450,max*3+38)});
    part.sentences.push(...copySentences(raw,source));part.tries++;
    if(requestedCTA(source)&&!part.sentences.some(s=>/nhắn tin|gửi tin nhắn|inbox/i.test(s)))part.sentences.push(requestedCTA(source));
    const edited=editCaption(part.sentences,min,max,/nhắn tin|inbox/i.test(source));
    if((wordCount(edited)<min || (/nhắn tin|inbox/i.test(source)&&!/nhắn tin|inbox|gửi tin nhắn/i.test(edited))) && part.tries<3)return null;
    part.body=edited;
    if(!part.body)throw Error('empty_caption');
    if(spec.photo&&!part.shot)return null;
  }else if(spec.photo&&!part.shot){
    const raw=await infer({system:'Bạn là người phụ trách ảnh cho một bài đăng. Mô tả một khung hình cụ thể, bằng đúng một câu tiếng Việt.',
      prompt:'Dữ kiện của thương hiệu:\n'+facts+'\nBài đăng đã viết:\n'+part.body+'\nHãy đề xuất MỘT bức ảnh có thể chụp tại tiệm. Mô tả chủ thể và góc máy bằng một câu ngắn. Không viết caption, tiêu đề hay danh sách.',maxTokens:90});
    part.shot=copySentences(raw.replace(/^(?:gợi ý ảnh|ảnh|hình ảnh)\s*:\s*/i,''),source)[0]||'';
    if(!part.shot)throw Error('empty_art_direction');
  }
  const final=part.body+(spec.photo?'\nẢnh: '+part.shot:'');
  job.captions.push({phase,text:final,issues:checkCaption(final,spec,source)});
  delete job.drafting;delete job.repairDraft;
  if(job.captions.length<spec.count)return null;
  return job.captions.map((cap,i)=>'Caption '+(i+1)+' · '+cap.phase+'\n\n'+cap.text).join('\n\n');
}

async function produce(brief,job,role,infer) {
  const source=briefText(brief,job);
  if(role==='content'){
    const spec=captionSpec(brief);
    if(spec)return captionPart(brief,job,spec,infer);
  }
  if(role==='qa'){editStoredCaptions(brief,job);if(reopenIncompleteCaption(brief,job))return null;}
  const command = {
    account:'Đọc yêu cầu và viết một câu giao việc bằng tiếng Việt cho đồng nghiệp. Nêu đúng sản phẩm và đầu ra. Tối đa 30 từ.',
    qa:'So brief với các sản phẩm do đồng nghiệp viết. Trả lời một câu tiếng Việt bắt đầu bằng ĐẠT hoặc CẦN SỬA. Giải thích kết luận.',
    strategy:'Viết ngay bản chiến lược để team thực hiện. Dùng tên sản phẩm trong brief và nêu lựa chọn cụ thể.',
    content:'Viết ngay nội dung hoàn chỉnh theo yêu cầu khách hàng để họ sử dụng.',
    creative:'Viết ngay hướng dẫn thiết kế cụ thể cho designer thực hiện, theo brief và content đã có.',
    performance:'Viết ngay kế hoạch media cụ thể để người phụ trách triển khai. Dùng đúng ngân sách nếu khách cung cấp.',
    account_work:'Hoàn thiện tài liệu điều phối mà khách đặt bằng tiếng Việt.',
    qa_work:'Viết báo cáo rà soát với phát hiện cụ thể và đề xuất sửa.'
  }[role];
  const prompt=['YÊU CẦU CỦA KHÁCH',source,references(job)?'ĐẦU RA CỦA ĐỒNG NGHIỆP\n'+references(job):'',command].filter(Boolean).join('\n\n');
  const raw=(await infer({system:roles[role],prompt,maxTokens:role==='account'?78:role==='qa'?110:650})).trim();
  if(!raw)throw Error('empty_deliverable');
  if(role==='account')return JSON.stringify({summary:raw,acceptance:[brief.deliverables || brief.brief],departments:job.pipeline.slice(1,-1),questions:[],needs_clarification:false});
  if(role==='qa'){
    const aiPassed=/^\s*(?:[\*#-]+\s*)?(?:đạt|pass)(?:\s|[.:,;*!–-]|$)/iu.test(raw);
    const issues=aiPassed?[]:[{department:job.pipeline[1],issue:raw,fix:'Xem nhận xét trước khi duyệt.'}];
    const checklist=[{criterion:'QA đối chiếu sản phẩm với brief',passed:aiPassed}];
    for(const [i,c] of (job.captions||[]).entries()){
      checklist.push({criterion:'Caption '+(i+1)+' · kiểm tra độ dài và định dạng',passed:!c.issues.length});
      for(const issue of c.issues)issues.push({department:'content',issue:'Caption '+(i+1)+': '+issue,fix:'Sửa theo yêu cầu của brief.'});
    }
    return JSON.stringify({summary:raw,passed:!issues.length,issues,checklist});
  }
  return raw;
}

export async function runAgencyRequest(request,{storage,infer,defer,authorize,continueOrder}) {
  const origin=new URL(request.url).origin;
  if (request.method!=='POST' || request.headers.get('origin')!==origin) return reply({error:'Yêu cầu không hợp lệ.'},403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({error:'Cần dữ liệu JSON.'},415);
  const raw=await request.text();
  if(raw.length>7200)return reply({error:'Yêu cầu quá dài.'},413);
  let input;try{input=JSON.parse(raw);}catch{return reply({error:'Yêu cầu không hợp lệ.'},400);}
  if (!uuid.test(input?.id) || !['advance','status','approve','revise'].includes(input.action)) return reply({error:'Order không hợp lệ.'},400);
  const id=input.id.toLowerCase(),path='outcomes/'+id+'.json';
  if(!authorize || !await authorize(id,request.headers.get('authorization')))return reply({error:'Phiên này chưa có quyền mở kết quả của order.'},403);
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
    }catch(error){if(error.name==='BlobPreconditionFailedError'||/already exists|precondition|etag/i.test(error.message)){console.info('office_checkpoint_contended',error.name);return false;}throw error;}
  };
  const conflict=async()=>reply({job:publicState((await read(storage,path)).data)},202);
  if(job.status==='review' && !job.copyReviewed && !job.lease){
    const changed=editStoredCaptions(brief,job);
    job.copyReviewed=true;
    const reopened=reopenIncompleteCaption(brief,job);
    if(changed && !reopened){delete job.outputs.qa;job.status='running';job.runningRole='qa';}
    if(!await save())return conflict();
  }
  if(input.action==='status')return reply({job:publicState(job),needsAdvance:job.status==='running' && !(job.lease?.expires>Date.now() || job.availableAt>Date.now())});
  if ((job.lease && job.lease.expires>Date.now()) || job.availableAt>Date.now()) return reply({job:publicState(job)},202);
  if(['approve','revise'].includes(input.action) && input.version!==job.version)return reply({error:'Bản bàn giao đã thay đổi. Mở lại order để xem phiên bản hiện tại.'},409);
  if(input.action==='approve'){
    if(job.status==='approved')return reply({job:publicState(job)});
    if(job.status!=='review'||!job.outputs.qa)return reply({error:'Chưa có bản bàn giao để duyệt.'},409);
    job.status='approved';job.approvedAt=new Date().toISOString();return await save()?reply({job:publicState(job)}):conflict();
  }
  if(input.action==='revise'){
    if(!['review','approved'].includes(job.status)||typeof input.feedback!=='string'||!input.feedback.trim()||input.feedback.length>5000)return reply({error:'Nhập phản hồi trên bản đã bàn giao.'},400);
    if(job.version>=5)return reply({error:'Order đã có 5 phiên bản. Hãy mở order mới cho yêu cầu tiếp theo.'},409);
    job.history.push({version:job.version,outputs:job.outputs,approvedAt:job.approvedAt||null});
    job.outputs={};job.captions=[];delete job.autoCopyPass;delete job.drafting;delete job.repairDraft;job.feedback=input.feedback.trim();job.version++;job.status='running';job.approvedAt=null;job.runningRole='account';job.error=null;
    if (!await save()) return conflict();
    if (continueOrder && defer) defer(continueOrder(id).catch(error=>console.warn('revision_dispatch',error?.name)));
    return reply({job:publicState(job)});
  }
  if(['review','approved'].includes(job.status))return reply({job:publicState(job)});
  const role=job.pipeline.find(step=>!job.outputs[step]);
  if(!role)return reply({error:'Order thiếu thông tin bàn giao.'},409);
  job.status='running';job.runningRole=role;job.error=null;delete job.availableAt;job.lease={token:randomUUID(),expires:Date.now()+297000};
  if (!await save())return conflict();
  console.info('office_step_started',role,job.calls);
  async function completeStep(){
    try {
      const output=await produce(brief,job,role,infer);
      if(output) job.outputs[role]=output;
      if(role==='qa')job.copyReviewed=true;
      if(role!=='qa'||output)job.calls++;job.capacityRetries=0;
      job.runningRole=job.pipeline.find(step=>!job.outputs[step])||null;
      job.status=job.runningRole?'running':'review';
    } catch (error) {
      const diagnostic=String(error?.message||error?.name||'').slice(0,400);
      console.warn('department_engine',role,diagnostic.replace(/https?:\/\/\S+/g,'[url]'));
      if (diagnostic==='engine_busy' && (job.capacityRetries||0)<12) {
        job.capacityRetries=(job.capacityRetries||0)+1;
        job.status='running';job.availableAt=Date.now()+9000;
      } else {
        job.status='error';
        job.error='Phòng '+role+' chưa tạo xong đầu ra. Có thể tiếp tục từ bước này.';
        job.runningRole=null;
      }
    }
    delete job.lease;
    if (!await save()) return conflict();
    if (job.status==='running' && continueOrder) {
      if(job.availableAt)await new Promise(resolve=>setTimeout(resolve,Math.max(0,job.availableAt-Date.now())));
      await continueOrder(id);
    }
    return reply({job:publicState(job)});
  }
  if (defer) {
    const accepted=reply({job:publicState(job)},202);
    defer(completeStep().catch(error=>console.warn('department_checkpoint',error?.name)));
    return accepted;
  }
  return completeStep();
}
