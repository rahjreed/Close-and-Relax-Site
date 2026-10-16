export const INSURANCE_LEAD_STATUSES = Object.freeze([
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'closed', label: 'Closed' },
  { value: 'not_interested', label: 'Not Interested' },
]);

// These RPCs authorize each request against the private server-side allowlist.
// Contact details remain in component memory, never analytics or localStorage.
export async function isPlatformAdmin(client) {
  try {
    const { data, error } = await client.rpc('is_platform_admin');
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function loadInsuranceLeads(client, offset = 0) {
  const { data, error } = await client.rpc('list_insurance_leads', {
    page_size: 50,
    page_offset: offset,
  });
  if (error || !Array.isArray(data))
    throw new Error(
      'Unable to load insurance leads. Check your administrator access and try again.',
    );
  return data;
}

export async function updateInsuranceLeadStatus(client, id, status) {
  if (!INSURANCE_LEAD_STATUSES.some((item) => item.value === status))
    throw new Error('Choose a valid lead status.');
  const { data, error } = await client.rpc('update_insurance_lead_status', {
    lead_id: id,
    new_status: status,
  });
  if (error || data !== status)
    throw new Error('Unable to update this lead. Check your administrator access and refresh.');
  return data;
}
