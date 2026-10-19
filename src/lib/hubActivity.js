const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const deviceUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const HUB_EVENT_SOURCES = Object.freeze({
  hub_view: ['public_hub'], standalone_open: ['installed_hub'],
  save_click: ['main_button','floating_button'], install_accepted: ['main_button','floating_button'],
  ios_instructions: ['main_button','floating_button'],
  savings_vivint_click: ['homeowner_savings'], savings_goosehead_click: ['homeowner_savings'],
});
const memoryIds = new Map();
export function getHubDeviceId(profileId,storage,createId) {
  if (typeof profileId!=='string' || !uuid.test(profileId)) return null;
  if (memoryIds.has(profileId)) return memoryIds.get(profileId);
  const key=`closeandrelax-device-id-${profileId}`;
  let id;
  try { id=storage?.getItem(key); } catch { /* Keep one in-memory ID if storage is blocked. */ }
  if (!deviceUuid.test(id)) {
    try { id=createId(); } catch { return null; }
    if (!deviceUuid.test(id)) return null;
    try { storage?.setItem(key,id); } catch { /* No persistent storage is required. */ }
  }
  memoryIds.set(profileId,id);
  return id;
}
export async function sendHubActivity(client,{profileId,deviceId,eventType,source,preview=false}) {
  if (preview || typeof profileId!=='string' || !uuid.test(profileId) || typeof deviceId!=='string' || !deviceUuid.test(deviceId)
    || typeof eventType!=='string' || !Object.hasOwn(HUB_EVENT_SOURCES,eventType) || !HUB_EVENT_SOURCES[eventType].includes(source)) return false;
  try {
    const {data,error}=await client.rpc('record_hub_activity',{payload:{profile_id:profileId,device_id:deviceId,event_type:eventType,source}});
    return !error && data===true;
  } catch { return false; } // Telemetry must never block the homeowner experience.
}
