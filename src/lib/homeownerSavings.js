import { insuranceUrl } from './insuranceFunnel.js';
import { getVivintTextHref } from './partnerContacts.js';

export const SAVINGS_CLICK_EVENTS = Object.freeze({
  vivint: 'savings_vivint_click',
  goosehead: 'savings_goosehead_click',
});

export const HOMEOWNER_SAVINGS_OFFERS = Object.freeze([
  {
    code: 'vivint',
    title: 'Vivint Home Security',
    eyebrow: 'Home security & smart home',
    description:
      'Explore home security and smart-home options through your Realtor’s Close & Relax hub. Connect with a Vivint contact to discuss your home and available services.',
    ctaLabel: 'Explore Vivint home security',
  },
  {
    code: 'goosehead',
    title: 'Home & Auto Insurance',
    eyebrow: 'Home, auto, or both',
    description:
      'Explore home and auto insurance options with Goosehead. Request a callback to discuss coverage and pricing with an insurance professional.',
    ctaLabel: 'Explore insurance options',
  },
]);

export const canHideHomeownerSavings = (plan) =>
  String(plan || 'partner').toLowerCase() === 'premier';

export const shouldShowHomeownerSavings = (profile) =>
  !canHideHomeownerSavings(profile?.plan) || profile?.homeowner_savings_visible !== false;

export function normalizeSavingsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    )
      return '';
    return url.href;
  } catch {
    return '';
  }
}

export function resolveHomeownerSavingsOffers(destinations = []) {
  return HOMEOWNER_SAVINGS_OFFERS.map((offer) => {
    const destination = destinations.find(({ code }) => code === offer.code);
    // Insurance requests always use the private, validated submission flow.
    const webUrl = offer.code === 'vivint' ? normalizeSavingsUrl(destination?.cta_url) : '';
    return {
      ...offer,
      href: webUrl || (offer.code === 'vivint' ? getVivintTextHref('homeowner') : insuranceUrl()),
      external: Boolean(webUrl),
      ctaLabel:
        !webUrl && offer.code === 'vivint' ? 'Ask about Vivint home security' : offer.ctaLabel,
    };
  });
}

export async function loadHomeownerSavingsDestinations(client) {
  try {
    const { data, error } = await client.from('homeowner_savings_offers').select('code, cta_url');
    if (error) throw error;
    return { offers: resolveHomeownerSavingsOffers(data || []), error: null };
  } catch {
    return {
      offers: resolveHomeownerSavingsOffers(),
      error:
        'Some provider links are currently unavailable. You can still contact the Close & Relax Vivint team below.',
    };
  }
}

export async function saveHomeownerSavingsVisibility(client, profile, visible) {
  if (!profile?.id || !canHideHomeownerSavings(profile.plan))
    throw new Error('Only Pro accounts can change Homeowner Savings visibility.');
  if (typeof visible !== 'boolean') throw new Error('Choose whether to show Homeowner Savings.');
  const { data, error } = await client
    .from('profiles')
    .update({ homeowner_savings_visible: visible })
    .eq('id', profile.id)
    .select('id, plan, homeowner_savings_visible')
    .single();
  if (error) throw new Error('Unable to update Homeowner Savings. Please try again.');
  return data;
}
