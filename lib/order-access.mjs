import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {get,put} from '@vercel/blob';
const path='agency-internal/order-access-v1.json';
let secretPromise;
async function loadSecret(){
  const read=async()=>{
    const value=await get(path,{access:'private',useCache:false});
    if(!value || value.statusCode!==200)return null;
    const key=(await new Response(value.stream).json()).key;
    if(!/^[a-f0-9]{64}$/.test(key))throw Error('Invalid access configuration');
    return key;
  };
  const existing=await read();
  if(existing)return existing;
  const key=randomBytes(32).toString('hex');
  try{
    await put(path,JSON.stringify({key}),{access:'private',allowOverwrite:false,addRandomSuffix:false,contentType:'application/json'});
    return key;
  }catch(error){
    const winner=await read();
    if(!winner)throw error;
    return winner;
  }
}
export async function orderAccess(id) {
  secretPromise ??= loadSecret().catch(error=>{secretPromise=undefined;throw error;});
  return createHmac('sha256',Buffer.from(await secretPromise,'hex')).update('work:'+id).digest('hex');
}
export async function canAccess(id,auth) {
  if(typeof auth!=='string'||!/^Bearer [a-f0-9]{64}$/.test(auth))return false;
  return timingSafeEqual(Buffer.from(auth.slice(7),'hex'),Buffer.from(await orderAccess(id),'hex'));
}
