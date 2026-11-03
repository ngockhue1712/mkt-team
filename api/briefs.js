import {get,put} from '@vercel/blob';
import {receiveBrief} from '../lib/brief-inbox.mjs';
import {orderAccess} from '../lib/order-access.mjs';
export default {async fetch(request){
  const response=await receiveBrief(request,{get,put});
  if(!response.ok)return response;
  const receipt=await response.json();
  try {
    return Response.json({...receipt,workToken:await orderAccess(receipt.id)},{status:response.status,headers:{'Cache-Control':'private, no-store'}});
  } catch {
    return Response.json({error:'Chưa cấp được quyền truy cập kết quả. Gửi lại cùng mã brief.'},{status:503});
  }
}};
