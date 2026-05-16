const RESEND_API_URL = 'https://api.resend.com/emails';

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL || 'CommandPost <noreply@commandpost.rekindleleads.com>';

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set, skipping email send');
    return false;
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend API error ${res.status}: ${body}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[email] Failed to send:', err);
    return false;
  }
}
