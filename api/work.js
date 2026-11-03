import { get, put } from '@vercel/blob';
import { writeWithModel } from '../lib/office-model.mjs';
import { runAgencyRequest } from '../lib/agency-work.mjs';
export default { async fetch(request) {
  try { return await runAgencyRequest(request,{storage:{get,put},infer:writeWithModel}); }
  catch (err) { console.warn('agency_storage',err?.name); return Response.json({error:'Chưa đọc được trạng thái. Vui lòng thử lại.'},{status:503}); }
} };
