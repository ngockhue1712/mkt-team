// Only the configured production deployment may receive a private order token.
export async function dispatchOrder(id, token, {env=process.env, send=fetch}={}) {
  if (env.VERCEL_ENV !== 'production') return false;
  const host = env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!host || !/^[a-zA-Z0-9.-]+$/.test(host)) throw Error('production_host_missing');
  const origin = 'https://' + host;
  for (let attempt=0; attempt<2; attempt++) {
    let response;
    try {
      response = await send(origin+'/api/work', {
        method:'POST', redirect:'error',
        headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+token},
        body:JSON.stringify({id,action:'advance'}), signal:AbortSignal.timeout(11000)
      });
    } catch (error) {
      if (attempt===0) continue;
      throw error;
    }
    if (response.ok) return true;
    if (attempt===1 || (response.status<500 && response.status!==429)) throw Error('work_dispatch_'+response.status);
  }
}
