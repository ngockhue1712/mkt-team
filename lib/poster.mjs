// Draw only our own vector primitives. Briefs and model output supply text and
// validated design choices, never markup, external images or executable SVG.
const palettes={
  leaf:['#F4F1DF','#153F35','#B7CB86','#F3A86B'],
  rose:['#F8EBE3','#552D3D','#E8AFBE','#B7C3A0'],
  ocean:['#EAF2F1','#183957','#99C8CF','#FFB681'],
  cobalt:['#EEEFFD','#202D69','#A8B6FA','#F4B750'],
  citrus:['#FFF3DC','#513727','#F4AA57','#9FBA83'],
  plum:['#F1EBF7','#44315A','#C9AFE1','#F1B5A1']
};
const subjects={
  notebook:['Sổ tay',/sổ tay|sổ ghi|notebook|planner/i],
  books:['Sách',/đổi sách|cuốn sách|hội sách|tiệm sách|quyển sách|book(shop|s)?\b/i],
  drink:['Đồ uống',/cà phê|trà\s|matcha|cacao|coffee|latte/i],
  flower:['Hoa',/bó hoa|tiệm hoa|cắm hoa|hoa tươi|bouquet|floral/i],
  bag:['Túi xách',/túi xách|túi đeo|túi da|handbag|tote/i],
  cosmetics:['Chăm sóc sắc đẹp',/mỹ phẩm|serum|son môi|chăm sóc da|skincare|dưỡng da/i],
  bakery:['Bánh',/tiệm bánh|bánh ngọt|bánh kem|bakery|cupcake|pastry/i],
  audio:['Âm nhạc',/tai nghe|âm nhạc|đêm nhạc|headphone|concert|podcast/i],
  camera:['Nhiếp ảnh',/máy ảnh|nhiếp ảnh|camera|photobooth/i],
  fashion:['Thời trang',/áo thun|áo phông|áo khoác|thời trang|t-shirt|quần áo/i],
  tech:['Công nghệ',/điện thoại|ứng dụng|phần mềm|app\b|công nghệ|smartphone/i],
  event:['Sự kiện',/sự kiện|workshop|khai trương|sinh nhật|lễ hội|vé mời/i],
  custom:['Minh họa',/$^/]
};
const fold=text=>String(text||'').normalize('NFC').trim();
const xml=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const safeCopy=(v,n)=>typeof v==='string'?fold(v).replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').slice(0,n).trim():'';
function recognize(source){
  return Object.keys(subjects).find(key=>key!=='custom' && source && subjects[key][1].test(source));
}
function paletteFor(source){
  if(/tím|lavender|purple|violet/i.test(source))return 'plum';
  if(/hồng|rose|pink/i.test(source))return 'rose';
  if(/xanh dương|cobalt|xanh lam|royal blue/i.test(source))return 'cobalt';
  if(/xanh biển|xanh ngọc|aqua|teal/i.test(source))return 'ocean';
  if(/xanh lá|xanh rêu|xanh sage|xanh lục|sage|green/i.test(source))return 'leaf';
  if(/màu cam|vàng|orange|vàng cam/i.test(source))return 'citrus';
}
function brandFrom(brief){
  return safeCopy(brief.brand?.name||brief.brief?.match(/\b((?:Tiệm|Quán|Studio)\s+[\p{Lu}][\p{L}\d'-]*(?:\s+[\p{Lu}][\p{L}\d'-]*){0,3})/u)?.[1],46);
}
function explicitHeadline(text){
  return text.match(/(?:headline|tiêu đề|dòng chữ chính|thông điệp chính|tựa đề)\s*(?:là|thành|sang|mới)?\s*[:=]?\s*[“"‘']([^”"’'\n]{1,90})/iu)?.[1];
}
function formats(text){
  const result=[];
  if(/1\s*:\s*1|1080\s*[x×]\s*1080|(?:bài|post|ảnh|poster) vuông|vuông và/i.test(text))result.push(['Bài đăng vuông',1080,1080]);
  if(/9\s*:\s*16|1080\s*[x×]\s*1920|\bstor(?:y|ies)\b/i.test(text))result.push(['Story dọc',1080,1920]);
  if(/16\s*:\s*9|1920\s*[x×]\s*1080|banner ngang|ảnh bìa ngang/i.test(text))result.push(['Banner ngang',1920,1080]);
  return result.length?result:[['Bài đăng vuông',1080,1080]];
}

export async function artDirection(brief,job,infer){
  const request=[brief.brief,brief.deliverables,job.feedback].filter(Boolean).join('\n');
  if (recognize(request) && explicitHeadline(request)) return null;
  const prompt=['BRIEF: '+safeCopy(brief.brief,800),'ĐẦU RA: '+safeCopy(brief.deliverables,260),'THƯƠNG HIỆU: '+brandFrom(brief),
    'BÀN GIAO: '+safeCopy(job.outputs.creative||job.outputs.content||job.outputs.account,490),
    'CHỈNH SỬA: '+safeCopy(job.feedback,450),
    'Đặt một headline tiếng Việt 3–7 từ cho poster. Chọn chủ thể và bảng màu phù hợp nhất. Nếu chọn custom, vẽ đường bao của chủ thể bằng một đường SVG path trong ô 100x100; chỉ dùng M L Q C Z và tọa độ 0–100.'].join('\n');
  const schema={type:'object',properties:{headline:{type:'string'},subject:{type:'string',enum:Object.keys(subjects)},palette:{type:'string',enum:Object.keys(palettes)},silhouette:{type:'string'}},required:['headline','subject','palette','silhouette'],additionalProperties:false};
  const output=await infer({system:'Bạn là họa sĩ vẽ minh họa cho poster. Dựa vào thông tin khách đưa. Không bịa tên, giá, khuyến mãi, thời gian hay liên kết. Trả về JSON. Với chủ thể có sẵn, silhouette là chuỗi rỗng.',prompt,schema,maxTokens:180,deadline:Date.now()+65000});
  try{return JSON.parse(output);}catch{return {};}
}
const star=(x,y,r)=>`<path d="M${x} ${y-r}q0 ${r} ${r} ${r}q-${r} 0 -${r} ${r}q0 -${r} -${r} -${r}q${r} 0 ${r} -${r}Z"/>`;
function silhouettePath(value){
  if(typeof value!=='string'||value.length>520||!/^\s*M[0-9.,\sMLQCZ]+Z\s*$/i.test(value))return '';
  const parts=value.toUpperCase().trim().match(/[MLQCZ][^MLQCZ]*/g)||[];
  if(parts.length<4 || parts.length>30)return '';
  for(const part of parts){
    const cmd=part[0],nums=part.slice(1).trim().split(/[\s,]+/).filter(Boolean);
    if(nums.length!==({M:2,L:2,Q:4,C:6,Z:0})[cmd]||nums.some(n=>!/^\d+(?:\.\d+)?$/.test(n)||+n>100))return '';
  }
  return value.toUpperCase();
}
function drawing(kind,c,custom){
  const [paper,ink,tint,accent]=c;
  const path=(d,fill,more='')=>`<path d="${d}" fill="${fill}" ${more}/>`;
  const ellipse=(cx,cy,rx,ry,fill)=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
  const rect=(x,y,w,h,r,fill)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
  const lines=d=>path(d,'none',`stroke="${ink}" stroke-width="3" stroke-linecap="round"`);
  const group=(t,items)=>`<g transform="${t}">${items}</g>`;
  const leaf=(x,y,rotation,color)=>group(`translate(${x} ${y}) rotate(${rotation})`,path('M0 0Q-38 -65 -7 -103Q46 -49 0 0Z',color)+lines('M0 -2Q-6 -40 -8 -77'));
  const petal=(x,y,scale)=>group(`translate(${x} ${y}) scale(${scale})`,Array.from({length:7},(_,i)=>group('rotate('+i*360/7+')',ellipse(0,-25,15,26,paper))).join('')+ellipse(0,0,13,13,accent));
  const book=(x,y,r,cover)=>group(`translate(${x} ${y}) rotate(${r})`,path('M-117 -8L26 -48L123 -10L-18 37Z',cover)+path('M-117 -8L-18 37V59L-117 14Z',ink)+path('M-18 37L123 -10V12L-18 59Z',paper)+lines('M-10 42L112 2M-9 49L112 8')+path('M46 -22l27 11 -48 15 -27 -11Z',paper));
  switch(kind){
    case 'books':return book(3,39,-7,tint)+book(-8,-12,8,accent)+book(8,-65,-5,paper)+path('M40 -96l17 7 -24 8v29l-9 -5 -9 10v-30Z',accent);
    case 'notebook':return group('rotate(-14)',rect(-85,-111,174,231,12,ink)+rect(-91,-119,174,226,11,accent)+rect(-80,-119,12,225,4,paper)+rect(-45,-73,102,59,4,paper)+lines('M-32 -52H42M-32 -40H19')+path('M41 101v33l9 -8 10 8v-33Z',tint))+group('rotate(30) translate(114 -12)',rect(-6,-97,13,171,3,paper)+path('M-6 74l6 22 7 -22Z',ink));
    case 'drink':return ellipse(-3,78,119,21,paper)+path('M61 -47Q145 -59 124 -3Q115 26 61 27V8Q103 10 105 -15Q110 -32 65 -28Z',accent)+path('M-88 -64Q-89 63 -35 74Q38 95 65 53Q80 24 79 -56Z',paper)+ellipse(-4,-59,83,25,ink)+ellipse(-4,-60,69,16,accent)+path('M-31 -56Q-7 -78 14 -59Q26 -72 41 -67Q27 -44 -7 -48Z',paper)+lines('M-55 -18Q-51 18 -38 39M-30 -102q-15 -20 2 -37M3 -100q17 -23 3 -41');
    case 'flower':return lines('M-7 93L-62 -65M-7 94L57 -86M-7 94L2 -106')+leaf(-30,25,-58,tint)+leaf(1,37,64,tint)+petal(-63,-74,0.92)+petal(4,-115,1)+petal(63,-84,0.84)+path('M-68 -3L-4 117L54 4L-5 24Z',accent)+lines('M-40 10L-9 95M-4 28L-4 84');
    case 'bag':return path('M-62 -43Q-66 -132 -6 -132Q49 -132 52 -44H37Q32 -111 -6 -111Q-45 -109 -46 -44Z',ink)+path('M-96 -63L78 -63L111 101Q3 132 -107 96Z',accent)+path('M78 -63l33 164 -26 -8 -21 -145Z',tint)+path('M-44 -30Q-39 11 -2 13Q36 12 39 -30', 'none',`stroke="${ink}" stroke-width="7"`)+rect(-22,42,47,15,5,paper);
    case 'cosmetics':return group('rotate(-9)',rect(-80,-26,96,143,15,accent)+rect(-70,-51,75,33,6,paper)+rect(-61,-112,58,67,11,ink)+rect(-70,14,75,48,2,paper)+lines('M-60 31H-6M-59 42H-23'))+group('translate(68 -8) rotate(13)',rect(-31,-65,63,178,10,paper)+rect(-29,75,59,39,6,tint)+path('M-15 -67v-40q20 -24 31 -19v59Z',accent));
    case 'bakery':return ellipse(0,86,121,21,paper)+path('M-92 23V77Q0 111 93 76V23Z',accent)+ellipse(0,22,93,31,paper)+path('M-92 19Q-77 5 -65 20Q-46 55 -32 28Q-17 13 -2 34Q12 50 27 27Q43 14 55 27Q75 48 92 19V7Q0 -22 -90 5Z',paper)+path('M-62 -6V-40Q0 -66 59 -38V-9Q-3 14 -62 -6Z',tint)+ellipse(-1,-40,60,17,paper)+ellipse(0,-77,24,24,accent)+lines('M0 -98q-4 -28 24 -38');
    case 'audio':return path('M-107 33V-15C-107 -156 107 -156 107 -15V33H85V-14C85 -126 -85 -126 -85 -14V33Z',paper)+group('rotate(-11 -86 44)',rect(-106,-8,46,107,20,accent)+rect(-78,-3,21,97,10,ink))+group('rotate(11 86 44)',rect(60,-9,47,107,20,accent)+rect(57,-4,21,97,10,ink))+lines('M66 88Q54 132 10 113');
    case 'camera':return group('rotate(-8)',rect(-119,-59,237,151,19,accent)+path('M-56 -58l18 -34h62l20 34Z',ink)+rect(-90,-74,30,12,4,paper)+ellipse(7,17,60,60,ink)+ellipse(7,17,45,45,paper)+ellipse(7,17,33,33,tint)+ellipse(-4,5,9,9,paper)+rect(77,-37,22,12,3,paper));
    case 'fashion':return path('M-42 -108Q0 -84 43 -109L107 -75L142 -18L80 12L62 -17L74 104Q0 123 -76 104L-60 -19L-82 12L-142 -17L-106 -78Z',paper)+path('M-42 -108Q-5 -64 43 -109Q1 -84 -42 -108Z',accent)+lines('M-106 -76L-77 -24M111 -72L83 -27M-53 91Q1 105 53 90')+group('translate(-14 -8) scale(.47)',path('M0 46L-40 -2Q-62 -53 -18 -48Q-5 -48 0 -30Q30 -66 48 -35Q68 -11 0 46Z',accent));
    case 'tech':return group('rotate(-12)',rect(-73,-126,148,257,18,ink)+rect(-63,-108,128,215,9,paper)+rect(-18,-118,39,4,2,tint)+rect(-49,-89,98,70,7,tint)+path('M-40 -35l24 -23 15 13 29 -27 14 37Z',accent)+rect(-47,-2,79,9,4,ink)+rect(-47,16,97,7,3,tint)+rect(-47,31,64,7,3,tint)+rect(-47,67,65,20,10,accent));
    case 'event':return group('rotate(-12)',path('M-129 -68H129V-21Q98 -7 125 12V69H-129V17Q-94 2 -129 -23Z',accent)+lines('M68 -53v14m0 9v15m0 10v14m0 10v15m0 10v14')+group('translate(-30 0) scale(1.2)',star(0,0,43))+rect(82,-41,8,16,3,paper)+rect(82,-16,8,55,3,paper));
    default:{
      const d=silhouettePath(custom);
      if(d)return group('translate(-109 -109) scale(2.18)',path(d,paper,`stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"`));
      return group('rotate(-14)',path('M-116 74Q-140 -76 -29 -108Q67 -144 111 -42Q140 46 68 94Q-2 135 -54 66Q-79 36 -43 8Q-13 -15 10 10Q34 38 54 12Q78 -26 34 -49Q-26 -78 -48 -9Q-62 31 -75 91Z',accent)+ellipse(-74,-85,24,24,paper)+ellipse(95,81,16,16,tint));
    }
  }
}

function textLines(title,limit){
  const lines=[''];
  for(const word of title.split(/\s+/)){
    const i=lines.length-1;
    if(lines[i] && lines[i].length+word.length+1>limit)lines.push(word);
    else lines[i]+=(lines[i]?' ':'')+word;
  }
  return lines;
}

function renderPoster(spec,format){
  const [name,width,height]=format,[paper,ink,tint,accent]=spec.colors;
  const wide=width>height,tall=height>width;
  const w=wide?1280:720,h=w*height/width;
  const frame=wide?{x:648,y:77,w:578,h:h-154}:{x:44,y:tall?386:255,w:632,h:tall?601:337};
  const cx=frame.x+frame.w/2,cy=frame.y+frame.h/2;
  const radius=Math.min(frame.w,frame.h)*.37;
  const lines=textLines(spec.title,wide?17:23);
  const size=Math.min(wide?64:65,(wide?455:606)/Math.max(1,...lines.map(l=>l.length*.63)),(wide?240:tall?240:149)/lines.length);
  const headY=wide?222:56+(frame.y-56-size*1.11*lines.length)/2+size*.80;
  const ctaY=wide?548:tall?1125:663;
  const footer=spec.cta?`<rect x="49" y="${ctaY-33}" width="${Math.min(wide?525:620,spec.cta.length*12+75)}" height="52" rx="26" fill="${ink}"/><text x="73" y="${ctaY}" fill="${paper}" font-size="21" font-weight="700">${xml(spec.cta)}</text>`:'';
  const art=groupArt();
  function groupArt(){
    const top=frame.y+14,left=frame.x+26,right=frame.x+frame.w-20,bottom=frame.y+frame.h;
    return `<clipPath id="frame"><rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" rx="24"/></clipPath>
    <g clip-path="url(#frame)"><rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" fill="${tint}"/>
    <circle cx="${cx+35}" cy="${cy-15}" r="${radius}" fill="${paper}" opacity=".62"/>
    <path d="M${left-56} ${bottom-48} Q${cx} ${bottom-130} ${right+60} ${bottom-38} V${bottom+14} H${left-56}Z" fill="${accent}" opacity=".46"/>
    <g fill="${ink}" opacity=".7">${star(left+65,top+frame.h*.30,16)}${star(right-61,top+frame.h*.2,11)}${star(right-81,bottom-frame.h*.25,18)}</g>
    <ellipse cx="${cx}" cy="${cy+radius*.84}" rx="${radius*.98}" ry="${radius*.12}" fill="${ink}" opacity=".15"/>
    <g transform="translate(${cx} ${cy+7}) scale(${Math.min(frame.w/325,frame.h/307)})" stroke="${ink}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round" fill="${paper}">${drawing(spec.subject,spec.colors,spec.silhouette)}</g>
    </g>`;
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${w} ${h}" role="img"><title>${xml(spec.title)}</title><desc>${xml(spec.alt)}</desc>
    <rect width="${w}" height="${h}" fill="${paper}"/><g font-family="Arial,DejaVu Sans,sans-serif" fill="${ink}">
    <path d="M49 48h32" stroke="${ink}" stroke-width="4"/><text x="94" y="54" font-size="17" letter-spacing="2" font-weight="700">${xml((spec.brand||subjects[spec.subject][0]).toLocaleUpperCase('vi'))}</text>
    <text x="46" y="${headY}" font-family="Georgia,DejaVu Serif,serif" font-size="${size}" font-weight="700">${lines.map((line,i)=>`<tspan x="46" dy="${i?size*1.11:0}">${xml(line)}</tspan>`).join('')}</text>
    ${art}${footer}<path d="M49 ${h-32}H${w-49}" stroke="${ink}" opacity=".4" stroke-width="1.4"/></g></svg>`;
  return {name,width,height,title:spec.title,alt:spec.alt,svg};
}

export function makePosters(brief,job,model={}){
  if(!model || typeof model!=='object')model={};
  const request=[brief.brief,brief.deliverables].filter(Boolean).join('\n'), feedback=job.feedback||'';
  const source=feedback+'\n'+request;
  const subject=recognize(feedback)||recognize(request)||(Object.hasOwn(subjects,model.subject)?model.subject:recognize(job.outputs?.creative||job.outputs?.content||'')||'custom');
  const brand=brandFrom(brief);
  const quoted=request.match(/[“"]([^”"\n]{3,58})[”"]/u)?.[1];
  const drafted=safeCopy(model.headline,60);
  const modelTitle=drafted && !/(?:https?:|www\.|[<>]|shopname|headline|lorem ipsum)/i.test(drafted) && !/\d/.test(drafted.replace(/\d+/g,n=>source.includes(n)?'':n))?drafted:'';
  const shortTitle=brief.title && brief.title!==brief.brief?.slice(0,150) && brief.title.length<52 ? brief.title : '';
  const topic=subject==='books' && /đổi sách/i.test(request)?'Hẹn nhau đổi sách':brand?subjects[subject][0]+' · '+brand:subjects[subject][0];
  const title=safeCopy(explicitHeadline(feedback)||explicitHeadline(request)||modelTitle||quoted||shortTitle||(subject==='custom'?safeCopy(brief.brief?.split(/[.!?\n]/)[0],52):topic)||'Ý tưởng mới',70);
  const cta=safeCopy(source.match(/(?:CTA|lời kêu gọi)\s*(?:là|thành|sang)?\s*[:=]?\s*[“"‘']?([^\n.!?,”"’']{2,42})(?=[\n.!?,”"’']|$)/iu)?.[1],42);
  const palette=paletteFor(feedback)||paletteFor(request)||(Object.hasOwn(palettes,model.palette)?model.palette:paletteFor(job.outputs?.creative||'')||({books:'leaf',notebook:'rose',drink:'citrus',flower:'rose',tech:'cobalt',audio:'plum'}[subject])||'ocean');
  const colors=[...palettes[palette]];
  const hex=source.match(/#[0-9a-f]{6}\b/i)?.[0];if(hex)colors[2]=hex;
  const spec={title,subject,colors,brand,cta,silhouette:model.silhouette,alt:'Poster '+subjects[subject][0].toLocaleLowerCase('vi')+' cho “'+title+'”'};
  const layout=/(?:vuông|ngang|story|\d+\s*[:×x]\s*\d+)/i.test(feedback)?feedback:request;
  return formats(layout).map(f=>renderPoster(spec,f));
}
