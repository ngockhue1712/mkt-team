import { get, put } from '@vercel/blob';
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
    return await runAgencyRequest(request,{storage:{get,put},infer:writeWithModel,defer:waitUntil,authorize:canAccess,continueOrder:continueProductionOrder});
  } catch (err) {
    console.warn('agency_storage',err?.name);
    return Response.json({error:'Chưa đọc được trạng thái. Vui lòng thử lại.'},{status:503});
  }
} };
