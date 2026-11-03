import { get, put, head } from '@vercel/blob';
import { canAccess, orderAccess } from '../lib/order-access.mjs';
import { waitUntil } from '@vercel/functions';
import { writeWithModel } from '../lib/office-model.mjs';
import { runAgencyRequest } from '../lib/agency-work.mjs';

import { generateGPTImage } from '../lib/gpt-image.mjs';
import { dispatchOrder } from '../lib/dispatch-order.mjs';

export default { async fetch(request) {
  try {
    const started=Date.now(),deadline=started+274000;
    const origin=new URL(request.url).origin;
    const services={storage:{get,put,head},infer:args=>writeWithModel({...args,deadline:Math.min(deadline,args.deadline??deadline)}),authorize:canAccess,gptEnabled:!!process.env.OPENAI_IMAGE_API_KEY,generateImage:(brief,job)=>generateGPTImage(brief,job,{storage:{put,head},apiKey:process.env.OPENAI_IMAGE_API_KEY,dailyLimit:process.env.STUDIO_IMAGE_DAILY_LIMIT})};
    async function continueWarm(id,nextRole){
      if(Date.now()-started>90000 || (nextRole==='gpt_image' && process.env.VERCEL_ENV==='production'))return dispatchOrder(id,await orderAccess(id));
      const next=new Request(origin+'/api/work',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+await orderAccess(id)},body:JSON.stringify({id,action:'advance'})});
      await runAgencyRequest(next,{...services,continueOrder:continueWarm});
    }
    return await runAgencyRequest(request,{...services,defer:waitUntil,continueOrder:continueWarm});
  } catch (err) {
    console.warn('agency_storage',err?.name);
    return Response.json({error:'Chưa đọc được trạng thái. Vui lòng thử lại.'},{status:503});
  }
} };
