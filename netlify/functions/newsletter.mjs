import { db } from './utils/db.mjs';
import { json } from './utils/auth.mjs';
import { sendEmail, newsletterWelcomeHTML } from './utils/email.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const body = await req.json().catch(() => null);
  const email = body?.email?.trim();
  if (!email || !email.includes('@')) {
    return json({ error: 'A valid email is required' }, { status: 400 });
  }

  const database = db();
  const rows = await database.sql`
    INSERT INTO newsletter_subscribers (email) VALUES (${email})
    ON CONFLICT (email) DO NOTHING
    RETURNING email
  `;

  // Only send the welcome email on a genuinely new subscription — not on a repeat signup attempt.
  if (rows.length) {
    await sendEmail({
      to: email,
      subject: 'Welcome to the ZOEZONE community',
      html: newsletterWelcomeHTML(),
    });
  }

  return json({ ok: true });
};

export const config = { path: '/api/newsletter' };
