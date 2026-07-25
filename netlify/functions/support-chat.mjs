import { json } from './utils/auth.mjs';
import { checkRateLimit, clientIp } from './utils/rate-limit.mjs';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 2000;

const SYSTEM_INSTRUCTION = `You are the customer support assistant for ZOEZONE (zoezone.co), a high-end streetwear brand rooted in Haitian heritage — bold, punk-funk, never basic. Every piece is cut and sewn in Haiti from 100% heavyweight cotton, oversized/relaxed fits.

LAUNCH STATUS: Only the Tops category is live for sale right now. Bottoms, Outerwear, and Accessories are shown on the site as "Coming Soon" and cannot be purchased yet.

SHIPPING: Free shipping on orders $75+; otherwise a flat $6.95 shipping fee. Orders are confirmed manually over WhatsApp after checkout — the customer gets an exact ETA at that point. Standard delivery within Haiti takes 3-7 business days once confirmed.

RETURNS & EXCHANGES: Accepted within 30 days of delivery if the item is unworn, unwashed, and still has its original tags. Message ZOEZONE on WhatsApp with the order confirmation number to start a return or exchange. Sale items are final sale unless the item arrived damaged or defective. Accessories (jewelry, sunglasses, socks) are final sale for hygiene reasons. If an order arrives damaged or wrong, the customer should message within 7 days of delivery with a photo and their confirmation number.

PAYMENT METHODS: MonCash, PayPal, and Zelle. MonCash payments are auto-converted from USD to HTG at checkout at the store's daily rate, shown clearly with the exact HTG amount to send. PayPal adds a flat $5 transaction fee (covers PayPal's own charge), shown and included in the total before the customer confirms. Credit/debit card payment is coming soon but not available yet. All of these are manual payment methods that require uploading a screenshot of the payment as proof at checkout.

SIZING: Most pieces are cut oversized and relaxed by design — when in doubt, recommend sizing down for a closer fit. Tops sizing (chest measured pit-to-pit, length from shoulder seam): XS 20"chest/26"length/7"sleeve, S 21"/27"/7.5", M 22.5"/28"/8", L 24"/29"/8.5", XL 25.5"/30"/9". Point customers to the Size Guide page (size-guide.html) for full measurements and bottoms sizing.

ACCOUNTS & REFERRALS: Customers must create an account or sign in to check out. Every customer gets a shareable referral code; when a friend creates an account with it, both people get 10% off their next order once the new account's email is verified.

ORDER TRACKING: Customers can check their order status anytime at track-order.html using their confirmation number and the email used at checkout.

WHAT YOU CANNOT DO: You have no access to any customer's actual account, order, or payment information — you cannot look up a specific order status, confirm whether a specific payment was received, or make any changes to an account or order. Never invent or guess specific order details, tracking numbers, or dates.

TONE: Warm, direct, concise — a few sentences per answer, not paragraphs. Match the brand's confident, no-fluff voice.

ESCALATION: If the customer needs something you can't help with (anything account/order/payment-specific, a complaint, or a question you're genuinely not confident about), say so plainly and let them know you're connecting them to the team on WhatsApp. When you do this, end your reply with the exact text "[ESCALATE]" on its own new line — that's a signal for the website to show a WhatsApp button, not something to explain or mention to the customer.`;

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set.');
    return json({ error: 'Chat support is not configured yet — please reach out on WhatsApp instead.' }, { status: 500 });
  }

  const allowed = await checkRateLimit(`support-chat:${clientIp(req)}`, { maxAttempts: 30, windowMinutes: 15 });
  if (!allowed) {
    return json({ error: "You're sending messages a little fast — please wait a bit and try again." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const message = body?.message?.trim();
  const history = Array.isArray(body?.history) ? body.history : [];

  if (!message) return json({ error: 'Please enter a message.' }, { status: 400 });
  if (message.length > MAX_MESSAGE_LENGTH) {
    return json({ error: 'That message is too long — please shorten it.' }, { status: 400 });
  }

  const trimmedHistory = history
    .slice(-MAX_HISTORY_MESSAGES)
    .filter((m) => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string');

  const contents = [
    ...trimmedHistory.map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, MAX_MESSAGE_LENGTH) }] })),
    { role: 'user', parts: [{ text: message }] },
  ];

  let geminiRes;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents,
          generationConfig: { maxOutputTokens: 350, temperature: 0.4 },
        }),
      }
    );
  } catch (err) {
    console.error('Gemini request failed:', err);
    return json({ error: "Couldn't reach support chat — please try again or message us on WhatsApp." }, { status: 502 });
  }

  if (!geminiRes.ok) {
    const errBody = await geminiRes.text().catch(() => '');
    console.error('Gemini API error:', geminiRes.status, errBody);
    return json({ error: "Couldn't reach support chat — please try again or message us on WhatsApp." }, { status: 502 });
  }

  const data = await geminiRes.json();
  let text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) {
    return json({ error: "Didn't get a response — please try again or message us on WhatsApp." }, { status: 502 });
  }

  let escalate = false;
  if (text.includes('[ESCALATE]')) {
    escalate = true;
    text = text.replace('[ESCALATE]', '').trim();
  }

  return json({ reply: text, escalate });
};

export const config = { path: '/api/support-chat' };
