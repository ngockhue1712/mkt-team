// One owner-funded generation per order version. Keep pixels in private storage,
// never in browser storage, order JSON or the public deployment.
const options={access:'private',allowOverwrite:false,addRandomSuffix:false};
const conflict=e=>e?.name==='BlobPreconditionFailedError'||/already exists|precondition/i.test(e?.message||'');
async function claim(storage,path,body){
  try{await storage.put(path,body,{...options,contentType:'text/plain'});return true;}
  catch(error){if(conflict(error))return false;throw error;}
}
export function imageMode(brief,job){
  const text=(job.feedback||'')+'\n'+brief.brief+'\n'+(brief.deliverables||'');
  const detect=t=>/ảnh (?:chụp|thật|chân thực)|photoreal|realistic photo|như chụp/i.test(t)?'photo':/ảnh thiết kế|graphic design|poster|key visual/i.test(t)?'design':null;
  return detect(job.feedback||'')||(['photo','design','vector'].includes(brief.imageMode)?brief.imageMode:detect(text)||'design');
}
export function imagePath(id,version){return 'artwork/'+id+'/v'+version+'.png';}
const notice=message=>({status:'unavailable',message});
export async function generateGPTImage(brief,job,{storage,apiKey,send=fetch,dailyLimit=10}){
  const mode=imageMode(brief,job);
  if(mode==='vector')return {status:'vector'};
  if(!apiKey)return notice('Studio chưa bật GPT Image. Bản minh họa vector có sẵn bên dưới.');
  const layout=job.artwork[0],size=layout.width===layout.height?'1024x1024':layout.width>layout.height?'1536x864':'864x1536';
  const [width,height]=size.split('x').map(Number);
  const asset={kind:'gpt',mode,version:job.version,width,height,title:layout.title,name:mode==='photo'?'Ảnh phong cách chụp · GPT Image':'Ảnh thiết kế · GPT Image',alt:(mode==='photo'?'Ảnh AI phong cách chụp':'Thiết kế do GPT Image tạo')+' cho “'+layout.title+'”'};
  const path=imagePath(brief.id,job.version);
  try{if(await storage.head(path))return {status:'ready',asset};}
  catch(e){if(e.name!=='BlobNotFoundError'&&!/not found|does not exist/i.test(e.message||''))throw e;}
  if(!await claim(storage,path+'.request','started'))return notice('Lượt tạo ảnh này đã được gửi. Studio giữ bản vector để tránh tính phí lặp.');
  const limit=Number.isInteger(+dailyLimit)?Math.max(0,Math.min(100,+dailyLimit)):10;
  const day=new Date().toISOString().slice(0,10);
  let reserved=false;
  for(let n=0;n<limit&&!reserved;n++)reserved=await claim(storage,'agency-internal/image-budget/'+day+'/'+n,brief.id+':'+job.version);
  if(!reserved)return notice('Studio đã dùng hết lượt GPT Image trong ngày. Bạn vẫn có thể duyệt bản vector.');
  const prompt=[mode==='photo'?'Create a photorealistic commissioned advertising photograph. Use convincing materials, natural lighting and an intentional camera angle. No UI or mockup framing. Only include type if the client explicitly requests it.':'Design a polished, ready-to-publish campaign key visual. Compose original imagery and typography as an actual graphic, not a picture of a poster on a wall.',
    'Client brief (Vietnamese): '+brief.brief,'Requested deliverables: '+(brief.deliverables||''),'Brand: '+JSON.stringify(brief.brand||{}).slice(0,1300),
    'Latest client revisions: '+(job.feedback||''),
    'Creative direction: '+(job.outputs.creative||job.outputs.content||'').slice(0,1300),
    'Use only names, product facts, offers, URLs and dates confirmed in the client brief. Respect any quoted Vietnamese headline verbatim, including accents. Output a single finished image.'].join('\n').slice(0,24000);
  const result=await send('https://api.openai.com/v1/images/generations',{method:'POST',redirect:'error',
    headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-image-2.5-flare',prompt,size,n:1,quality:'medium',output_format:'png'}),signal:AbortSignal.timeout(205000)});
  if(!result.ok){
    if(result.status===401||result.status===403)return notice('Studio cần kiểm tra quyền sử dụng GPT Image. Bản vector vẫn có thể duyệt.');
    if(result.status===429)return notice('GPT Image đang giới hạn lượt tạo hoặc tài khoản Studio đã hết hạn mức.');
    return notice('GPT Image chưa tạo được ảnh cho brief này. Bản minh họa vector vẫn có thể duyệt.');
  }
  const b64=(await result.json()).data?.[0]?.b64_json;
  if(typeof b64!=='string'||b64.length>27000000)throw Error('image_response_invalid');
  const bytes=Buffer.from(b64,'base64');
  if(bytes.length<33 || !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.readUInt32BE(16)!==width || bytes.readUInt32BE(20)!==height)throw Error('image_png_invalid');
  await storage.put(path,bytes,{...options,contentType:'image/png'});
  return {status:'ready',asset};
}

export async function readGPTImage(request,{storage,authorize}){
  const query=new URL(request.url).searchParams,id=query.get('id')||'',version=Number(query.get('v'));
  if(request.method!=='GET'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)||!Number.isInteger(version)||version<1||version>5)return new Response(null,{status:400});
  if(!await authorize(id,request.headers.get('authorization')))return new Response(null,{status:403});
  const stored=await storage.get(imagePath(id,version),{access:'private',useCache:false});
  if(stored?.statusCode!==200)return new Response(null,{status:404});
  return new Response(stored.stream,{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
