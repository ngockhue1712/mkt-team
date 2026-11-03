import {get,put} from '@vercel/blob';
import {receiveBrief} from '../lib/brief-inbox.mjs';
import {orderAccess} from '../lib/order-access.mjs';
import {dispatchOrder} from '../lib/dispatch-order.mjs';
export default {async fetch(request){
  const response=await receiveBrief(request,{get,put});
  if(!response.ok)return response;
  const receipt=await response.json();
  try {
    const workToken=await orderAccess(receipt.id);
    const background=await dispatchOrder(receipt.id,workToken);
    return Response.json({...receipt,workToken,background},{status:response.status,headers:{'Cache-Control':'private, no-store'}});
  } catch {
    return Response.json({error:'Đã lưu brief. Gửi lại cùng mã để kết nối với phòng phụ trách.'},{status:503});
  }
}};
