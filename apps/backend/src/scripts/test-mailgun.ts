import axios from 'axios';
import { config } from 'dotenv';

config({ path: '.env' });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function getDomainFromEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return null;
  }
  return normalized.slice(atIndex + 1);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findEventByMessageId(
  baseUrl: string,
  domain: string,
  apiKey: string,
  messageId: string,
) {
  const endpoint = `${baseUrl}/${domain}/events`;
  const response = await axios.get(endpoint, {
    auth: {
      username: 'api',
      password: apiKey,
    },
    params: {
      limit: 25,
      'message-id': messageId,
    },
    timeout: 15000,
  });

  const items = Array.isArray(response.data?.items) ? response.data.items : [];
  if (!items.length) {
    return null;
  }

  const terminal = items.find((item: any) =>
    ['delivered', 'failed', 'rejected', 'bounced', 'complained'].includes(String(item?.event || '').toLowerCase()),
  );

  return terminal || items[0];
}

async function main() {
  const recipient = process.argv[2] || process.env.TEST_EMAIL_TO;
  if (!recipient) {
    throw new Error('Provide recipient email as first argument or set TEST_EMAIL_TO in .env');
  }

  const apiKey = requireEnv('MAILGUN_API_KEY');
  const domain = requireEnv('MAILGUN_DOMAIN');
  const from = (process.env.MAILGUN_FROM || process.env.EMAIL_FROM || '').trim();
  if (!from) {
    throw new Error('Missing MAILGUN_FROM (or EMAIL_FROM) in .env');
  }

  const fromDomain = getDomainFromEmail(from);
  const normalizedMailgunDomain = domain.trim().toLowerCase();
  if (fromDomain && fromDomain !== normalizedMailgunDomain) {
    console.warn(
      `[Warning] MAILGUN_FROM domain (${fromDomain}) does not match MAILGUN_DOMAIN (${normalizedMailgunDomain}). ` +
      'This often causes delivery failures due to DMARC/SPF alignment.',
    );
  }

  const baseUrl = (process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net/v3').replace(/\/$/, '');
  const endpoint = `${baseUrl}/${domain}/messages`;

  const subject = `[Payforms] Mailgun Test ${new Date().toISOString()}`;
  const html = `
    <h2>Payforms Mailgun Test</h2>
    <p>If you received this, your Mailgun API configuration is working.</p>
    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
  `;

  const form = new URLSearchParams();
  form.append('from', from);
  form.append('to', recipient);
  form.append('subject', subject);
  form.append('html', html);
  form.append('text', 'Payforms Mailgun test message');
  form.append('o:tracking', 'yes');
  form.append('o:tracking-clicks', 'no');
  form.append('o:tracking-opens', 'no');

  const response = await axios.post(endpoint, form.toString(), {
    auth: {
      username: 'api',
      password: apiKey,
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 15000,
  });

  console.log('Mailgun test email sent successfully.');
  console.log('Recipient:', recipient);
  console.log('Response:', JSON.stringify(response.data));

  const messageId = String(response.data?.id || '').trim();
  if (!messageId) {
    return;
  }

  console.log(`Checking Mailgun events for message id: ${messageId}`);
  let finalEvent: any = null;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await sleep(5000);
    const event = await findEventByMessageId(baseUrl, domain, apiKey, messageId);
    if (!event) {
      console.log(`Attempt ${attempt}: no event yet`);
      continue;
    }

    const eventName = String(event.event || '').toLowerCase();
    console.log(`Attempt ${attempt}: latest event = ${eventName || 'unknown'}`);
    if (['delivered', 'failed', 'rejected', 'bounced', 'complained'].includes(eventName)) {
      finalEvent = event;
      break;
    }
  }

  if (!finalEvent) {
    console.log('No terminal event yet. Check Mailgun Logs dashboard after 1-2 minutes.');
    return;
  }

  const eventName = String(finalEvent.event || '').toLowerCase();
  if (eventName === 'delivered') {
    console.log('Delivery confirmed by Mailgun.');
    return;
  }

  const reason =
    finalEvent?.['delivery-status']?.description ||
    finalEvent?.reason ||
    finalEvent?.message ||
    'No reason provided by Mailgun';
  console.log(`Delivery issue detected: ${eventName}`);
  console.log(`Reason: ${reason}`);
}

main().catch((error: any) => {
  const message = error?.response?.data || error?.message || error;
  console.error('Mailgun test failed:', message);
  process.exit(1);
});
