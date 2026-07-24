# ZOEZONE — Deployment Guide

## Current live setup

| What | Where |
|---|---|
| Storefront | https://zoezone.co |
| Admin panel | https://zoezone.co/admin/login.html |
| GitHub repo | https://github.com/Edouard509/zoezone |
| Netlify site | `zoezone-shop` (dashboard: https://app.netlify.com/projects/zoezone-shop) |
| Database | Neon Postgres (connection string set as `DATABASE_URL` env var on Netlify) |
| Emails | SendGrid, domain-authenticated for `zoezone.co` — welcome emails from `hello@zoezone.co`, order confirmations from `orders@zoezone.co` |

Everything below this point is how it was set up, kept for reference — e.g. if
you ever need to redeploy from scratch, rotate credentials, or understand how
a piece fits together.

## 1. Admin login

Change your password any time from **Settings** inside the admin panel
(`/admin/settings.html`). The very first seed account (`admin@zoezone.com`,
now retired — you already changed it) came from
`netlify/database/migrations/0003_seed_admin.sql`.

To add more admin staff accounts, run one SQL statement against the database
(via Neon's SQL console, or `node -e` locally with the `DATABASE_URL`), since
there's no self-serve "invite admin" UI yet:

```sql
INSERT INTO admin_users (email, password_hash, name)
VALUES ('newperson@example.com', '<bcrypt-hash>', 'Their Name');
```

Generate the bcrypt hash first:

```bash
node -e "console.log(require('bcryptjs').hashSync('their-new-password', 10))"
```

## 2. Git & Netlify

The project is a GitHub repo (`Edouard509/zoezone`) connected to Netlify site
`zoezone-shop`. Every `git push origin main` doesn't auto-deploy by itself
here since deploys were done manually via `netlify deploy --prod` — to ship a
future code change:

```bash
git add -A
git commit -m "..."
git push origin main
netlify deploy --prod
```

(If you'd rather have Netlify auto-deploy on every push instead of running
that last command manually, connect the repo under **Site configuration →
Build & deploy → Continuous deployment** in the Netlify dashboard.)

## 3. Database (Neon Postgres)

Connects directly to Neon (the same underlying database Netlify's own paid
"Netlify DB" add-on uses — this project skips that paid wrapper and connects
to Neon directly, free tier, no card required).

- Connection string lives in the `DATABASE_URL` env var on Netlify.
- Migrations live in `netlify/database/migrations/*.sql` and do **not**
  auto-apply on deploy (that only happens with Netlify's own paid DB
  product). Whenever you add a new migration file, apply it by running:
  ```bash
  DATABASE_URL="<the connection string>" npm run migrate
  ```
  The script tracks what's already applied in a `_migrations` table, so it's
  always safe to re-run.

## 4. Environment variables

Set on the Netlify site (**Site configuration → Environment variables**):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `JWT_SECRET` | Signs admin/customer session cookies — long random string |
| `SENDGRID_API_KEY` | SendGrid API key, Mail Send permission only |
| `SENDGRID_FROM_EMAIL` | Default "from" for welcome emails (`hello@zoezone.co`) |

Order confirmation emails explicitly send from `orders@zoezone.co` regardless
of the `SENDGRID_FROM_EMAIL` default (set in `netlify/functions/orders.mjs`).

## 5. Email deliverability (SendGrid + domain authentication)

`zoezone.co` is authenticated in SendGrid (SPF/DKIM via CNAME records added
at Namecheap), which is why emails land in the inbox instead of spam —
sending "from" a bare `@gmail.com` or unauthenticated domain gets junked by
Gmail's DMARC policy regardless of SendGrid config.

If you ever move DNS providers or need to re-authenticate, the required
records are in SendGrid → **Settings → Sender Authentication**. Two rules
that caused real headaches getting this right the first time:
- Namecheap's **Host** field only wants the part *before* `.zoezone.co` —
  typing the full hostname there creates a doubled `.zoezone.co.zoezone.co`
  record that silently fails.
- Delete Namecheap's default parking records (`www` CNAME to
  `parkingpage.namecheap.com`, and the `@` URL Redirect record) — they
  conflict with the real site/DNS records.

## 6. Custom domain (zoezone.co)

DNS at Namecheap points to Netlify:
- `A` record: `@` → `75.2.60.5`
- `CNAME` record: `www` → `zoezone-shop.netlify.app`

SSL is auto-provisioned by Netlify (Let's Encrypt) once DNS resolves
correctly — no manual cert management needed.

## 7. Payment details at checkout

Real values are already wired into `js/checkout.js`:
- WhatsApp: `+509 3789 3926`
- MonCash: `+509 3789 3926`
- PayPal: `paypal.me/LakouLakayLLC`
- Zelle: `claudyedouard6@gmail.com`

(NatCash and Cash App were removed since they aren't offered.)

## What the admin panel can do

- **`/admin/login.html`** — staff sign-in.
- **`/admin/index.html`** — dashboard: order count, pending orders, revenue,
  active product count, recent orders.
- **`/admin/products.html`** — add, edit, delete products; upload photos;
  set prices and sale prices; toggle a product active/inactive without
  deleting it; assign categories (tops/bottoms/outerwear/accessories) and
  landing-page tags (The New Era, Best Seller).
- **`/admin/orders.html`** — view every order placed, see customer contact
  info (including email), items, payment method, and delivery location;
  update order status (pending → confirmed → shipped → delivered, or
  cancelled).
- **`/admin/settings.html`** — change your own admin password.

Every page under `/admin/*` is sent with `X-Robots-Tag: noindex, nofollow`
so search engines won't index it, but it is not otherwise hidden — anyone
with a login can sign in from the public URL, so keep admin credentials
private.

## Customer-facing emails

- **Welcome email** (on signup) — from `hello@zoezone.co`, sent by
  `netlify/functions/customer-signup.mjs`.
- **Order confirmation** (on checkout) — from `orders@zoezone.co`, sent by
  `netlify/functions/orders.mjs`. Checkout requires an email address for
  this reason — every order, guest or logged-in, gets a confirmation.

Both templates live in `netlify/functions/utils/email.mjs`.
