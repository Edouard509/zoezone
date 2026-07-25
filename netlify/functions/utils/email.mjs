// ZOEZONE — transactional email via SendGrid REST API (no SDK dependency needed).
const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';
const DEFAULT_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'hello@zoezone.co';
const FROM_NAME = 'ZOEZONE';

export async function sendEmail({ to, subject, html, text, fromEmail, fromName }) {
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
        from: { email: fromEmail || DEFAULT_FROM_EMAIL, name: fromName || FROM_NAME },
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

function escapeHTML(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function emailShell(bodyHTML, footerText) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;">
      <div style="background:#1a1a1a;padding:28px 24px;text-align:center;">
        <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:1px;">ZOEZONE</span>
      </div>
      <div style="padding:32px 28px;">${bodyHTML}</div>
      <div style="padding:20px 28px;border-top:1px solid #e7e5e1;font-size:11.5px;color:#888;text-align:center;">
        ${footerText}
      </div>
    </div>
  `;
}

export function welcomeEmailHTML({ firstName }) {
  const name = escapeHTML(firstName) || 'there';
  return emailShell(
    `
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
      <a href="https://zoezone.co" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:14px 28px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
        Start Shopping
      </a>
    `,
    'You\'re receiving this because you created an account at zoezone.co.'
  );
}

export function newsletterWelcomeHTML() {
  return emailShell(
    `
      <h1 style="font-size:20px;margin:0 0 16px;">You're In!</h1>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">
        Thanks for joining the ZOEZONE community — high-end, classy streetwear rooted in
        authentic Haitian heritage. Bold, punk-funk, never basic.
      </p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 24px;">
        You'll be the first to hear about new drops, restocks, and offers as they happen.
      </p>
      <a href="https://zoezone.co" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:14px 28px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
        Start Shopping
      </a>
    `,
    "You're receiving this because you subscribed at zoezone.co."
  );
}

export function passwordResetHTML({ firstName, resetUrl }) {
  const name = escapeHTML(firstName) || 'there';
  return emailShell(
    `
      <h1 style="font-size:20px;margin:0 0 16px;">Reset Your Password</h1>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">
        Hi ${name}, we got a request to reset your ZOEZONE password. Click below to set a new one —
        this link expires in 1 hour.
      </p>
      <a href="${resetUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:14px 28px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;">
        Reset Password
      </a>
      <p style="font-size:12.5px;line-height:1.6;color:#888;">
        Didn't request this? You can safely ignore this email — your password won't change.
      </p>
    `,
    "You're receiving this because a password reset was requested for your zoezone.co account."
  );
}

export function googleOnlyAccountHTML({ firstName }) {
  const name = escapeHTML(firstName) || 'there';
  return emailShell(
    `
      <h1 style="font-size:20px;margin:0 0 16px;">You Signed Up With Google</h1>
      <p style="font-size:14px;line-height:1.6;margin:0 0 20px;">
        Hi ${name}, we got a password reset request for your ZOEZONE account — but this account
        was created using "Continue with Google," so it doesn't have a password to reset.
        Just use the Google Sign-In button to log in instead.
      </p>
      <a href="https://zoezone.co/account.html" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:14px 28px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
        Go To Sign In
      </a>
    `,
    "You're receiving this because a password reset was requested for your zoezone.co account."
  );
}

export function orderConfirmationHTML({ order }) {
  const name = escapeHTML(order.customer.firstName) || 'there';
  const itemsRows = order.items
    .map((it) => {
      const variant = [it.color, it.size].filter(Boolean).map(escapeHTML).join(' / ');
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e7e5e1;font-size:13px;">
            ${it.qty}x ${escapeHTML(it.name)}${variant ? ` <span style="color:#999;">(${variant})</span>` : ''}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #e7e5e1;font-size:13px;text-align:right;">
            $${(it.price * it.qty).toFixed(2)}
          </td>
        </tr>
      `;
    })
    .join('');

  return emailShell(
    `
      <h1 style="font-size:20px;margin:0 0 8px;">Thanks, ${name}! Order received.</h1>
      <p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#555;">
        Confirmation #: <strong>${escapeHTML(order.id)}</strong>
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">${itemsRows}</table>
      <table style="width:100%;font-size:13px;margin-bottom:20px;">
        <tr><td style="padding:4px 0;">Subtotal</td><td style="padding:4px 0;text-align:right;">$${order.subtotal.toFixed(2)}</td></tr>
        <tr><td style="padding:4px 0;">Shipping</td><td style="padding:4px 0;text-align:right;">${order.shipping === 0 ? 'Free' : '$' + order.shipping.toFixed(2)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700;border-top:1px solid #e7e5e1;">Total</td><td style="padding:8px 0;font-weight:700;text-align:right;border-top:1px solid #e7e5e1;">$${order.total.toFixed(2)}</td></tr>
      </table>
      <p style="font-size:13px;line-height:1.6;margin:0 0 4px;color:#555;">
        Shipping to: ${escapeHTML(order.customer.address)}
      </p>
      <p style="font-size:13px;line-height:1.6;margin:0 0 20px;color:#555;">
        We'll follow up on WhatsApp (${escapeHTML(order.customer.whatsapp)}) to confirm delivery details.
      </p>
      <a href="https://zoezone.co" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:14px 28px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
        Continue Shopping
      </a>
    `,
    `Order placed at zoezone.co. Keep confirmation #${escapeHTML(order.id)} for your records.`
  );
}

const STATUS_COPY = {
  pending: { headline: 'Your order is pending', body: "We've got your order and it's awaiting confirmation." },
  confirmed: { headline: 'Your order is confirmed!', body: "We've confirmed your payment and we're getting your order ready." },
  shipped: { headline: 'Your order is on its way!', body: "Your order has shipped and is headed your way." },
  delivered: { headline: 'Your order has been delivered', body: "Your order was marked as delivered. We hope you love it!" },
  cancelled: { headline: 'Your order was cancelled', body: "This order has been cancelled. Reach out if that doesn't look right." },
};

export function orderStatusUpdateHTML({ orderId, firstName, status }) {
  const name = escapeHTML(firstName) || 'there';
  const copy = STATUS_COPY[status] || { headline: 'Your order status was updated', body: '' };
  return emailShell(
    `
      <h1 style="font-size:20px;margin:0 0 8px;">${escapeHTML(copy.headline)}</h1>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#555;">
        Hi ${name}, ${copy.body}
      </p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 20px;">
        Confirmation #: <strong>${escapeHTML(orderId)}</strong>
      </p>
      <a href="https://zoezone.co/track-order.html?id=${encodeURIComponent(orderId)}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:14px 28px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
        Track Your Order
      </a>
    `,
    `Order placed at zoezone.co. Keep confirmation #${escapeHTML(orderId)} for your records.`
  );
}
