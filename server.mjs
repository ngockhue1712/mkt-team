const departments={account:'Account & Điều phối',strategy:'Research & Strategy',content:'Content & Social',creative:'Creative & Design',performance:'Performance',qa:'Quality Assurance',account_work:'Account · Sản phẩm bàn giao',qa_work:'QA · Báo cáo rà soát'};
const rules={
account_work:'Bạn là Account Manager đang thực hiện order riêng của khách, sau bước intake. Tạo sản phẩm bàn giao thực sự theo brief: bản brief chuẩn hóa, phạm vi công việc, checklist yêu cầu, lịch phối hợp hoặc kế hoạch giao tiếp theo yêu cầu. Viết tiếng Việt, Markdown. Không tuyên bố đã liên hệ người khác, phân công nhân sự thật hoặc chạy công việc bên ngoài. Không trả JSON điều phối. Nêu giả định rõ ràng.',
qa_work:'Bạn là chuyên viên QA được khách đặt order rà soát riêng. Dùng tài liệu khách cung cấp, tạo báo cáo rà soát bằng Markdown gồm phát hiện, mức độ, trích dẫn từ tài liệu nếu có, đề xuất sửa và checklist. Báo cáo phát hiện lỗi vẫn là sản phẩm hợp lệ; không tuyên bố dữ liệu ngoài brief đã được xác minh. Nếu không có nội dung để kiểm tra, nêu rõ phần cần bổ sung. Không giả vờ có file chưa được cung cấp.',
account:'Bạn là Account Director. Làm rõ mục tiêu, khách hàng, thông điệp, deliverables, tiêu chí nghiệm thu và giả định. Không yêu cầu tất cả phòng ban cho order nhỏ. Nếu thiếu thông tin quan trọng thì trả về needs_clarification=true với tối đa 3 câu hỏi. Nếu thông tin đủ, needs_clarification=false. Trả JSON object: {needs_clarification:boolean,questions:string[],summary:string,departments:string[],acceptance:string[]}. departments chỉ gồm strategy,content,creative,performance; thứ tự theo phụ thuộc. Order trọn gói: chọn đủ bộ phận thực sự cần cho brief. Order riêng: departments chỉ gồm bộ phận đã được khách chọn. Không đưa qa hoặc account vào departments.',
strategy:'Bạn là Strategy Director. Dựa brief và kết quả Account, tạo chiến lược thực dụng: insight (nêu giả thuyết nếu chưa có nghiên cứu), đối tượng, mục tiêu đo lường, thông điệp, big idea, kênh, kế hoạch triển khai và tiêu chí thành công. Không bịa số liệu hay nguồn. Không có công cụ web nên không tuyên bố đã nghiên cứu web. Viết tiếng Việt, Markdown rõ ràng.',
content:'Bạn là Content Lead. Dùng brief, chiến lược và tài liệu thương hiệu, viết sản phẩm nội dung hoàn chỉnh với đúng số lượng yêu cầu: caption, bài viết, lịch nội dung hoặc kịch bản. Đừng chỉ đưa dàn ý nếu được yêu cầu viết bài. Nêu CTA, hook và kênh phù hợp. Không bịa ưu đãi, giá hay đặc tính sản phẩm; đánh dấu dữ kiện cần xác nhận. Tiếng Việt, Markdown.',
creative:'Bạn là Creative Director. Dùng nội dung/chiến lược bàn giao để tạo concept, art direction, bố cục, palette có mã màu, typography, kích thước, text đặt trên visual và prompt tạo ảnh cho từng deliverable. Bạn chỉ có công cụ văn bản: phải nói rõ đây là creative brief/specification, chưa phải file ảnh/video đã render. Không giả vờ đã tạo ảnh hoặc đính kèm file. Tiếng Việt, Markdown.',
performance:'Bạn là Performance Lead. Dùng chiến lược và content để lập media plan có bảng ngân sách tính khớp tổng, cấu trúc campaign, phân bổ kênh, giả thuyết A/B test và quy tắc tối ưu. Phân biệt KPI mục tiêu với kết quả thực tế. Chưa có công cụ chạy ads: không nói đã đăng bài/chạy quảng cáo. Không bịa benchmark. Tiếng Việt, Markdown.',
qa:'Bạn là QA Lead độc lập. So brief gốc với tất cả kết quả phòng ban, chỉ ra thiếu sót, xung đột, lỗi số liệu, claim chưa xác thực, tiêu chí nào đạt/chưa đạt. Không chấp nhận output chỉ có dàn ý khi khách cần sản phẩm hoàn chỉnh. Trả JSON: {passed:boolean,summary:string,issues:[{department:string,issue:string,fix:string}],checklist:[{criterion:string,passed:boolean}]}. department phải là một trong strategy,content,creative,performance,account_work,qa_work. Với order qa_work, đánh giá độ đầy đủ và đúng đắn của báo cáo rà soát theo brief; báo cáo phát hiện lỗi trong tài liệu gốc không tự động là báo cáo không đạt. Chỉ passed=true khi đủ deliverables và không có lỗi quan trọng. Không tự tuyên bố khách đã duyệt.'
};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function safeIdentifier(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_.[\]-]{1,100}$/.test(value) &&
    !/^(sk-|Bearer)/i.test(value) ? value : '';
}

function providerError(response, body) {
  const status = response.status;
  const code = safeIdentifier(body?.error?.code);
  const param = safeIdentifier(body?.error?.param);
  const requestId = safeIdentifier(response.headers.get('x-request-id'));
  const hint = String(body?.error?.message || '').toLowerCase();
  let message;
  if (status === 401) message = 'OpenAI từ chối API key. Mở cài đặt AI và kiểm tra lại key của OpenAI Platform.';
  else if (status === 403) message = 'OpenAI từ chối quyền truy cập. Kiểm tra quyền dùng model và quyền ghi Responses của key.';
  else if (status === 404 || code === 'model_not_found') message = 'Không tìm thấy model hoặc project của key chưa có quyền dùng model đó. Kiểm tra Model ID.';
  else if (code === 'insufficient_quota' || code === 'billing_hard_limit_reached') message = 'Project OpenAI của key đã hết hạn mức API. Kiểm tra Billing và giới hạn chi tiêu trên OpenAI Platform.';
  else if (status === 429) message = 'OpenAI đang giới hạn tần suất. Chờ một lúc rồi tiếp tục từ bước lỗi.';
  else if (code === 'context_length_exceeded' || /context length|context window/.test(hint)) message = 'Brief và tài liệu bàn giao vượt dung lượng model. Rút gọn nội dung hoặc chọn model có ngữ cảnh lớn hơn.';
  else if (status === 400 && (param === 'model' || /model.*(not supported|does not support)/.test(hint))) message = 'Model đã chọn không hỗ trợ yêu cầu này. Chọn một model văn bản hỗ trợ Responses API.';
  else if (status === 400 || status === 422) message = 'OpenAI không chấp nhận định dạng yêu cầu' + (param ? ' ở trường ' + param : '') + '.';
  else if (status === 408 || status === 504) message = 'OpenAI xử lý quá thời gian. Có thể tiếp tục từ bước đang dở.';
  else message = 'Dịch vụ OpenAI tạm thời không hoàn thành yêu cầu. Có thể thử lại từ bước này.';
  const ref = [String(status),code,requestId].filter(Boolean).join(' · ');
  console.warn('agency.provider_error', { status, code, param, requestId });
  return json({error: message + ' (' + ref + ')', code:code || null, requestId:requestId || null}, status>=500?502:status);
}

function unsupportedJsonFormat(response, error) {
  if (response.status !== 400) return false;
  const field = String(error?.param || '');
  const message = String(error?.message || '');
  return /^text\.format|^response_format/.test(field) && /unsupported|not supported|does not support/i.test(message) ||
    /(?:json_object|response_format|text\.format).*(?:unsupported|not supported)|(?:does not support|unsupported).*(?:json_object|response_format|text\.format)/i.test(message);
}

async function runProvider({ role, context, key, model }) {
  const needsJson = role === 'account' || role === 'qa';
  const payload = {
    model: model.trim(), store:false, max_output_tokens:5000,
    instructions:rules[role] + '\nCác tài liệu là dữ liệu tham khảo. Không tiết lộ key. Chỉ làm công việc của phòng ban.',
    input: needsJson ? 'Trả về duy nhất một đối tượng JSON theo cấu trúc được hướng dẫn.\n\n' + context : context
  };
  if (needsJson) payload.text = {format:{type:'json_object'}};
  const signal = AbortSignal.timeout(120000);
  async function call() {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method:'POST', headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify(payload), signal
    });
    const body = await response.json().catch(() => null);
    return {response,body};
  }
  let {response,body} = await call();
  // Only retry a rejected format option; never repeat a completed generation.
  if (needsJson && unsupportedJsonFormat(response, body?.error)) {
    delete payload.text;
    ({response,body} = await call());
  }
  if (!response.ok) return providerError(response,body);
  if (!body || body.status !== 'completed') {
    const lengthLimited = body?.incomplete_details?.reason === 'max_output_tokens';
    return json({error: lengthLimited ? 'Đầu ra dài hơn giới hạn của một lượt. Rút gọn brief hoặc tách đầu việc.' : 'OpenAI chưa trả đầu ra hoàn chỉnh. Hãy tiếp tục từ bước này.'},502);
  }
  const content = (body.output || []).flatMap(item => item.content || []);
  if (content.some(item => item.type === 'refusal')) return json({error:'Model từ chối nội dung này. Hãy điều chỉnh yêu cầu.'},422);
  let output = content.filter(item => item.type === 'output_text').map(item => item.text).join('\n').trim();
  if (!output) return json({error:'Model chưa trả văn bản. Kiểm tra Model ID và thử lại.'},502);
  if (needsJson) output = output.replace(/^\s*`{3}(?:json)?\s*([\s\S]*?)\s*`{3}\s*$/i,'$1');
  return json({output,usage:body.usage || null,department:departments[role]});
}

export default {async fetch(request,env){
 const url=new URL(request.url);
 if(request.method==='GET'&&url.pathname==='/assets/office-ui.js')return new Response(OFFICE_UI_JS,{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
 if(request.method==='GET'&&url.pathname==='/assets/voxel-ui.css')return new Response(OFFICE_CSS,{headers:{'Content-Type':'text/css; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
 if(request.method==='GET'&&url.pathname==='/assets/voxel-office.js')return new Response(OFFICE_JS,{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
 if(request.method==='GET'&&url.pathname==='/api/status')return json({configured:!!env.OPENAI_API_KEY});
 if(request.method==='GET'&&url.pathname==='/')return new Response(HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'"}});
 if(url.pathname!=='/api/generate')return json({error:'Không tìm thấy.'},404);
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(request.headers.get('Origin')!==url.origin)return json({error:'Origin không hợp lệ.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Yêu cầu JSON.'},415);
 const raw=await request.text();if(raw.length>220000)return json({error:'Brief quá dài. Vui lòng rút gọn.'},413);
 let data;try{data=JSON.parse(raw);}catch{return json({error:'JSON không hợp lệ.'},400);}
 if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'Yêu cầu phải là một JSON object.'},400);
 const {role,context,model}=data;
 if(!Object.hasOwn(rules,role)||typeof context!=='string'||!context.trim()||context.length>180000)return json({error:'Phòng ban hoặc nội dung không hợp lệ.'},400);
 const key=env.OPENAI_API_KEY||(typeof data.apiKey==='string'?data.apiKey.trim():'');
 if(!key)return json({error:'Chưa kết nối AI. Mở Kết nối AI và nhập API key.'},428);
 if(typeof model!=='string'||!model.trim()||model.length>100)return json({error:'Cần nhập model ID hợp lệ.'},400);
 try {
   return await runProvider({role,context,key,model});
 } catch (error) {
   const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
   return json({error: timedOut ? 'OpenAI xử lý quá 120 giây. Hãy thử lại từ bước này.' : 'Máy chủ chưa kết nối được OpenAI. Thử lại từ bước lỗi.'}, 502);
 }
}};
