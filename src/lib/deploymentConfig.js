const stagingProjectUrl = 'https://amopxaadnvubvveqpkvu.supabase.co';
const stagingHosts = new Set([
  'staging.closeandrelax.com',
  'staging-free.closeandrelax.com',
  'staging-core.closeandrelax.com',
  'staging-pro.closeandrelax.com',
]);

export function deploymentConfig(env = {}, hostname = '') {
  const staging = env.VITE_APP_ENV === 'staging';
  if (stagingHosts.has(hostname) && !staging) {
    throw new Error('Approved staging hosts require VITE_APP_ENV=staging.');
  }
  if (staging && env.VITE_SUPABASE_URL !== stagingProjectUrl) {
    throw new Error('Staging must use the isolated staging Supabase project.');
  }
  return {
    rootOrigin: staging ? 'https://staging.closeandrelax.com' : 'https://closeandrelax.com',
    rootHostname: staging ? 'staging.closeandrelax.com' : 'closeandrelax.com',
  };
}

export const deployment = deploymentConfig(
  import.meta.env || {},
  typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase(),
);
