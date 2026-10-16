import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INSURANCE_LEAD_STATUSES,
  isPlatformAdmin,
  loadInsuranceLeads,
  updateInsuranceLeadStatus,
} from '../src/lib/insuranceLeads.js';

test('admin discovery fails closed; only an explicit server true grants UI access', async () => {
  assert.equal(await isPlatformAdmin({ rpc: async () => { throw new Error('Network unavailable'); } }), false);
  for (const response of [
    { data: false },
    { data: null },
    { data: 'true' },
    { data: true, error: {} },
  ]) {
    assert.equal(await isPlatformAdmin({ rpc: async () => response }), false);
  }
  assert.equal(
    await isPlatformAdmin({
      rpc: async (name) => {
        assert.equal(name, 'is_platform_admin');
        return { data: true };
      },
    }),
    true,
  );
});

test('lead list uses the admin RPC with bounded pages and does not fall back to public tables', async () => {
  const rows = [{ id: 'test-id', full_name: 'Test Homeowner', status: 'new' }];
  const client = {
    rpc: async (name, args) => {
      assert.equal(name, 'list_insurance_leads');
      assert.deepEqual(args, { page_size: 50, page_offset: 50 });
      return { data: rows };
    },
  };
  assert.deepEqual(await loadInsuranceLeads(client, 50), rows);
  await assert.rejects(
    loadInsuranceLeads({ rpc: async () => ({ error: { message: 'sensitive database error' } }) }),
    /administrator access/,
  );
  await assert.rejects(loadInsuranceLeads({ rpc: async () => ({ data: null }) }));
});

test('all five statuses use the status-only RPC; invalid changes and server denials fail', async () => {
  assert.deepEqual(
    INSURANCE_LEAD_STATUSES.map((item) => item.label),
    ['New', 'Contacted', 'Qualified', 'Closed', 'Not Interested'],
  );
  for (const { value } of INSURANCE_LEAD_STATUSES) {
    const client = {
      rpc: async (name, args) => {
        assert.equal(name, 'update_insurance_lead_status');
        assert.deepEqual(args, { lead_id: 'test-id', new_status: value });
        return { data: value };
      },
    };
    assert.equal(await updateInsuranceLeadStatus(client, 'test-id', value), value);
  }
  await assert.rejects(
    updateInsuranceLeadStatus(
      {
        rpc() {
          assert.fail('Invalid status reached server');
        },
      },
      'test-id',
      'deleted',
    ),
  );
  await assert.rejects(
    updateInsuranceLeadStatus(
      { rpc: async () => ({ error: { message: 'denied' } }) },
      'test-id',
      'contacted',
    ),
    /administrator access/,
  );
});
