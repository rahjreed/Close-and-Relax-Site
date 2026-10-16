export {
  CALLBACK_WINDOWS,
  localToday,
  validateGooseheadLead,
} from '../../supabase/functions/_shared/gooseheadLead.js';

export async function submitGooseheadLead(client, lead, captchaToken, honeypot = '') {
  if (!captchaToken) throw new Error('Complete the verification before submitting.');
  const { data, error } = await client.functions.invoke('goosehead-lead', {
    body: { ...lead, captcha_token: captchaToken, company_website: honeypot },
  });
  if (error) {
    let message = 'Unable to submit right now. Please try again.';
    try {
      message = (await error.context.json()).error || message;
    } catch {
      /* No raw provider errors or contact data in UI/logs. */
    }
    throw new Error(message);
  }
  if (!data?.accepted) throw new Error('Your request was not confirmed. Please try again.');
}
