export function vendorLimitForPlan(plan) {
  const value=String(plan || 'partner').toLowerCase();
  return value==='premier'?30:['pro','core'].includes(value)?15:5;
}
const compareNullable=(a,b)=>a==null?(b==null?0:1):b==null?-1:a<b?-1:a>b?1:0;
const timestampOrder=value=>{
  if(value==null)return null;
  const milliseconds=Date.parse(value);
  if(!Number.isFinite(milliseconds))return null;
  // PostgreSQL timestamps have microseconds; retain them when milliseconds tie.
  const fraction=(String(value).match(/\.(\d+)/)?.[1] || '').padEnd(6,'0').slice(0,6);
  return BigInt(milliseconds)*1000n+BigInt(fraction.slice(3));
};
export const compareVendorOrder=(a,b)=>compareNullable(a.sort_order,b.sort_order) ||
  compareNullable(timestampOrder(a.created_at),timestampOrder(b.created_at)) ||
  compareNullable(String(a.id),String(b.id));

// Presentation defense only. The RPC independently selects and redacts rows in
// PostgreSQL; owner table reads intentionally retain all saved overflow records.
export function vendorsForHub(rows,plan) {
  const active=(Array.isArray(rows)?rows:[]).filter(v=>v && v.is_active!==false).slice().sort(compareVendorOrder);
  const customs=active.filter(v=>!v.is_default).slice(0,vendorLimitForPlan(plan));
  const standard=active.filter(v=>v.is_default).slice(0,1);
  const combined=[...standard,...customs];
  if(String(plan).toLowerCase()==='premier')combined.sort(compareVendorOrder);
  return combined.map(v=>({...v,recommendation:['pro','core','premier'].includes(String(plan).toLowerCase())?v.recommendation:null}));
}
export async function loadHubVendors(client,profileId) {
  const {data,error}=await client.rpc('get_hub_vendors',{hub_profile_id:profileId});
  if(error || !Array.isArray(data) || data.some(v=>v.profile_id!==profileId))
    throw new Error('Your saved hub vendors could not be loaded. Please retry.');
  return data.filter(v=>v.is_active!==false);
}
