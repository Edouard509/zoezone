# ZOEZONE — Deployment Guide

Your site now has a real backend: a Postgres database (products, orders,
customers, admin accounts), file storage for product photos, and a full
admin panel at `/admin`. This guide gets it live on Netlify.

## 1. First admin login

A starter admin account is seeded automatically the first time the database
migrations run:

```
Email:    admin@zoezone.com
Password: mMAqPPi3wE0f
```

**Change this password immediately after your first login** — go to
`/admin/settings.html` → Change Password. This seed password is sitting in
plain text in your migration file (`netlify/database/migrations/0003_seed_admin.sql`)
and in this guide, so treat it as burned the moment the site goes live.

To add more admin staff accounts later, the fastest path is running one
SQL statement against your database from the Netlify dashboard's database
console (Neon), since there's no self-serve "invite admin" UI yet:

```sql
-- generate a bcrypt hash for the password first (see note below), then:
INSERT INTO admin_users (email, password_hash, name)
VALUES ('newperson@example.com', '<bcrypt-hash>', 'Their Name');
```

To generate a bcrypt hash for a new password, run this locally (Node.js
with `bcryptjs` already installed in this project):

```bash
node -e "console.log(require('bcryptjs').hashSync('their-new-password', 10))"
```

## 2. Push this project to GitHub

Netlify deploys from a Git repository. Since this project isn't a repo yet:

```bash
git init
git add .
git commit -m "Initial commit — ZOEZONE storefront + backend"
```

Then create a new (private, recommended) repository on GitHub and push:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

## 3. Connect the repo to Netlify

1. In the Netlify dashboard, click **Add new site → Import an existing project**.
2. Choose GitHub, authorize if prompted, and select this repository.
3. Build settings — leave as detected (this is a static site with Netlify
   Functions, no build command needed):
   - **Build command:** *(leave blank)*
   - **Publish directory:** `.`
4. Deploy the site.

## 4. Provision the database

This project connects directly to a **Neon Postgres** database (the same
underlying database Netlify's own paid "Netlify DB" add-on uses — this
project just skips that paid wrapper and connects to Neon straight, which
has a free tier with no credit card required).

1. Sign up at [neon.tech](https://neon.tech) (free, no card needed) and
   create a new project.
2. From the project dashboard, copy the **connection string** (looks like
   `postgresql://user:password@ep-xxxx.neon.tech/dbname?sslmode=require`).
3. Set it as an environment variable on your Netlify site:
   ```bash
   netlify env:set DATABASE_URL "postgresql://user:password@ep-xxxx.neon.tech/dbname?sslmode=require"
   ```
   (or add it via **Site configuration → Environment variables** in the
   Netlify dashboard).
4. Run the migrations once, from your local machine, using that same
   connection string, to create every table and load your product catalog:
   ```bash
   DATABASE_URL="postgresql://user:password@ep-xxxx.neon.tech/dbname?sslmode=require" npm run migrate
   ```
   This applies, in order:
   - `0001_init_schema.sql` — creates every table.
   - `0002_seed_products.sql` — loads your full existing catalog (all
     products, prices, and reviews) so the store isn't empty on day one.
   - `0003_seed_admin.sql` — creates the starter admin login above.

   The script tracks what's already applied in a `_migrations` table, so
   it's always safe to re-run — already-applied migrations are skipped.
   Any time you add a new migration file later, just re-run `npm run migrate`
   with the same `DATABASE_URL` to apply it.

## 5. Set the JWT signing secret

Admin and customer logins are signed with a JWT. In your Netlify site's
**Site configuration → Environment variables**, add:

```
JWT_SECRET = <any long random string>
```

Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Without this set, the site falls back to an insecure default secret — fine
for testing, **not safe for a live store**. Set it before real customers
place real orders.

## 6. Swap in your real payment details

`js/checkout.js` currently has placeholder business contact info at the
top of the file:

```js
var BUSINESS_WHATSAPP_NUMBER = '18095551234'; // your real WhatsApp number, digits only
var PAY_INFO = {
  moncash: { label: 'MonCash', number: '+509 1234-5678', qr: true },
  natcash: { label: 'NatCash', number: '+509 8765-4321', qr: true },
  paypal:  { label: 'PayPal',  number: 'paypal.me/zoezoneshop', qr: false },
  zelle:   { label: 'Zelle',   number: 'payments@zoezone.com', qr: false },
  cashapp: { label: 'Cash App', number: '$ZoeZoneShop', qr: false }
};
```

Replace every value with your actual WhatsApp number and payment handles,
commit, and push — Netlify redeploys automatically.

## 7. Go live

Once deployed, Netlify gives you a URL like `random-name-123.netlify.app`.
From **Site configuration → Domain management** you can either keep that
or connect a custom domain you own.

Test the full path before announcing you're live:
1. Browse the catalog, add something to the cart, complete checkout with
   each payment method — confirm the order shows up in `/admin/orders.html`.
2. Sign up a test customer account on `/account.html`, confirm order
   history appears there too.
3. In `/admin/products.html`, add a test product with a photo, confirm it
   appears on the relevant category page and in search — then delete it.
4. Change the seeded admin password (step 1) if you haven't already.

## What the admin panel can do

- **`/admin/login.html`** — staff sign-in.
- **`/admin/index.html`** — dashboard: order count, pending orders, revenue,
  active product count, recent orders.
- **`/admin/products.html`** — add, edit, delete products; upload photos;
  set prices and sale prices; toggle a product active/inactive without
  deleting it; assign categories (tops/bottoms/outerwear/accessories) and
  landing-page tags (The New Era, Best Seller).
- **`/admin/orders.html`** — view every order placed, see customer contact
  info, items, payment method, and delivery location; update order status
  (pending → confirmed → shipped → delivered, or cancelled).
- **`/admin/settings.html`** — change your own admin password.

Every page under `/admin/*` is sent with `X-Robots-Tag: noindex, nofollow`
so search engines won't index it, but it is not otherwise hidden — anyone
with a login can sign in from the public URL, so keep admin credentials
private.
