// ZOEZONE — transactional email via SendGrid REST API (no SDK dependency needed).
const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'no-reply@zoezone.com';
const FROM_NAME = 'ZOEZONE';

export async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn('SENDGRID_API_KEY is not set — skipping email send.');
    return;
  }

  try {
    const res = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        content: [
          { type: 'text/plain', value: text || html.replace(/<[^>]+>/g, ' ') },
          { type: 'text/html', value: html },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('SendGrid send failed:', res.status, body);
    }
  } catch (err) {
    console.error('SendGrid send threw:', err);
  }
}

export function welcomeEmailHTML({ firstName }) {
  const name = firstName || 'there';
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;">
      <div style="background:#1a1a1a;padding:28px 24px;text-align:center;">
        <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:1px;">ZOEZONE</span>
      </div>
      <div style="padding:32px 28px;">
        <h1 style="font-size:20px;margin:0 0 16px;">Welcome, ${name}!</h1>
        <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">
          Thanks for creating an account with ZOEZONE — high-end, classy streetwear rooted in
          authentic Haitian heritage. You're in.
        </p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">
          Browse the latest drop, track your orders, and check out faster next time — it's all
          right there in your account.
        </p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 24px;">
          Free shipping on every order $75 and up.
        </p>
        <a href="https://zoezone-shop.netlify.app" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:14px 28px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
          Start Shopping
        </a>
      </div>
      <div style="padding:20px 28px;border-top:1px solid #e7e5e1;font-size:11.5px;color:#888;text-align:center;">
        You're receiving this because you created an account at zoezone-shop.netlify.app.
      </div>
    </div>
  `;
}
