import assert from 'node:assert/strict';
import test from 'node:test';
import { deploymentConfig } from '../src/lib/deploymentConfig.js';

test('staging requires its exact Supabase project and uses its approved root', () => {
  const env = { VITE_APP_ENV: 'staging', VITE_SUPABASE_URL: 'https://amopxaadnvubvveqpkvu.supabase.co' };
  for (const host of ['staging.closeandrelax.com', 'staging-free.closeandrelax.com', 'staging-core.closeandrelax.com', 'staging-pro.closeandrelax.com']) {
    assert.equal(deploymentConfig(env, host).rootOrigin, 'https://staging.closeandrelax.com');
    assert.throws(() => deploymentConfig({}, host), /VITE_APP_ENV/);
  }
  for (const url of [undefined, '', 'https://other-project.supabase.co', 'https://amopxaadnvubvveqpkvu.supabase.co.evil.invalid']) {
    assert.throws(() => deploymentConfig({ ...env, VITE_SUPABASE_URL: url }), /isolated staging/);
  }
});

test('ordinary builds retain the existing root and recovery destination', () => {
  assert.equal(deploymentConfig({}).rootOrigin, 'https://closeandrelax.com');
});
