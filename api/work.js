import { get, put, head } from '@vercel/blob';
import { canAccess, orderAccess } from '../lib/order-access.mjs';
import { waitUntil } from '@vercel/functions';
import { writeWithModel } from '../lib/office-model.mjs';
import { runAgencyRequest } from '../lib/agency-work.mjs';

async function continueProductionOrder(id) {
  const host=process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.VERCEL_ENV!=='production' || !host || !/^[a-zA-Z0-9.-]+$/.test(host)) return;
  const origin='https://'+host;
  try {
    const response=await fetch(origin+'/api/work',{method:'POST',
      headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+await orderAccess(id)},
      body:JSON.stringify({id,action:'advance'}),signal:AbortSignal.timeout(18000)
    });
    if(!response.ok)console.warn('department_continuation',response.status);
  } catch(error){console.warn('department_continuation',error?.name);}
}
export default { async fetch(request) {
  try {
    const started=Date.now(),deadline=started+274000;
    const origin=new URL(request.url).origin;
    const services={storage:{get,put,head},infer:args=>writeWithModel({...args,deadline}),authorize:canAccess};
    async function continueWarm(id){
      if(Date.now()-started>90000)return continueProductionOrder(id);
      const next=new Request(origin+'/api/work',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+await orderAccess(id)},body:JSON.stringify({id,action:'advance'})});
      await runAgencyRequest(next,{...services,continueOrder:continueWarm});
    }
    return await runAgencyRequest(request,{...services,defer:waitUntil,continueOrder:continueWarm});
  } catch (err) {
    console.warn('agency_storage',err?.name);
    return Response.json({error:'Chưa đọc được trạng thái. Vui lòng thử lại.'},{status:503});
  }
} };
