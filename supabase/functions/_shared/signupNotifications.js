const json = (status, result) => new Response(JSON.stringify(result), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const mailbox = value => typeof value === 'string' && value.length<=254 && /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(value);
async function sameSecret(actual, expected) {
  const digest = async text => new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
  const [a,b] = await Promise.all([digest(actual),digest(expected)]);
  let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;
}
export function createSignupNotificationHandler({env,claim,finish,fetcher=fetch,now=()=>Date.now()}) {
  return async request => {
    if(request.method!=='POST')return json(405,{error:'Method not allowed.'});
    const secret=env('SIGNUP_NOTIFICATION_WORKER_SECRET');
    if(!secret || secret.length<32)return json(503,{error:'Worker unavailable.'});
    const supplied=request.headers.get('Authorization')||'';
    if(supplied.length>1024 || !await sameSecret(supplied,`Bearer ${secret}`))return json(401,{error:'Unauthorized.'});
    if(request.headers.has('Origin'))return json(403,{error:'Server requests only.'});
    if(env('SIGNUP_NOTIFICATIONS_ENABLED')!=='true')return json(200,{disabled:true});
    const from=env('SIGNUP_NOTIFICATION_FROM'),to=env('SIGNUP_NOTIFICATION_TO'),apiKey=env('RESEND_API_KEY');
    if(!mailbox(from)||!mailbox(to)||!apiKey)return json(503,{error:'Worker unavailable.'});
    // Never accept a recipient, profile ID, message or notification event from the caller.
    let jobs;
    try {
      const result=await claim(from,to);
      if(result.error||!Array.isArray(result.data)||result.data.length>5)throw Error();
      jobs=result.data;
    } catch { return json(503,{error:'Queue unavailable.'}); }
    let accepted=0,failed=0,unconfirmed=0;
    for(const job of jobs) {
      const age=now()-Date.parse(job.first_attempt_at);
      // Defense in depth for a delayed worker; leave an expired lease for DB review.
      if(!Number.isFinite(age)||age<0||age>=23*60*60*1000){unconfirmed++;continue;}
      let outcome='retry',id=null;
      try {
        const response=await fetcher('https://api.resend.com/emails',{
          method:'POST',signal:AbortSignal.timeout(10000),
          headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`realtor-signup/${job.profile_id}`},
          // The database freezes the entire request, including sender/recipient, on first claim.
          body:JSON.stringify(job.payload),
        });
        if(response.ok) {
          const receipt=await response.json();
          if(typeof receipt.id==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(receipt.id)){outcome='accepted';id=receipt.id;}
        } else if(response.status>=400&&response.status<500&&![408,429].includes(response.status))outcome='rejected';
      } catch { /* Ambiguous provider outcome: retry the identical idempotent request. */ }
      try {
        const result=await finish(job.profile_id,job.lease_id,outcome,id);
        if(result.error||result.data!==true)throw Error();
        if(outcome==='accepted')accepted++;else failed++;
      } catch { unconfirmed++; } // Lease expiry recovers a send accepted before a lost DB acknowledgement.
    }
    // Counts only. No addresses, names, IDs, provider response bodies or errors in output/logs.
    return json(unconfirmed?503:200,{processed:jobs.length,accepted,failed,unconfirmed});
  };
}
