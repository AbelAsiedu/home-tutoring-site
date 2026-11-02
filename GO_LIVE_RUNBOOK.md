# The Modern Pedagogues Go-Live Runbook

This is the production checklist for hosting TMP, enabling Stripe marketplace payments, and operating the admin system. The application is an Express server that embeds the Next.js frontend. Deploy the repository root, not `frontend/` as a separate production app.

## 1. Prepare the production services

Create these services before deploying:

1. A Node.js host such as Heroku, Render, Railway, Fly.io, or a VPS.
2. A managed PostgreSQL database for production. SQLite is suitable for local development only.
3. Persistent object storage for uploads, preferably Cloudflare R2 or S3. On Fly.io, this deployment stores uploads under the encrypted `/data` volume via `UPLOADS_DIR=/data/uploads`; do not remove that volume.
4. An SMTP or transactional email provider for verification, password reset, order, and admin emails.
5. A Stripe account with the business identity, payout bank account, tax settings, and production mode enabled.
6. A domain with HTTPS. Do not accept production payments over plain HTTP.

## 2. Configure production environment variables

Set secrets in the hosting provider's secret manager. Do not commit `.env`.

Required application settings:

```env
NODE_ENV=production
PORT=3001
BASE_URL=https://your-domain.example
SESSION_SECRET=<long-random-secret>
ADMIN_USERNAME=<unique-admin-username>
ADMIN_EMAIL=<admin-email>
ADMIN_PASSWORD=<long-unique-admin-password>
TRUST_PROXY=true
COOKIE_SAMESITE=lax
```

Database and storage:

```env
DATABASE_URL=<managed-postgresql-connection-string>
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret>
R2_BUCKET=<bucket-name>
R2_PUBLIC_BASE_URL=https://media.your-domain.example
```

Email:

```env
EMAIL_SERVICE=smtp
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-password>
EMAIL_FROM=noreply@your-domain.example
```

Stripe:

```env
STRIPE_SECRET=sk_live_...
STRIPE_PUBLISHABLE=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=usd
MARKETPLACE_COMMISSION_RATE=0.30
```

Use the currency your Stripe account and business actually settle in. The marketplace checkout reads `STRIPE_CURRENCY`; never change currency casually after real transactions exist.

## 3. Deploy the application

From the repository root:

```bash
npm ci
cd frontend
npm ci
npm run build
cd ..
npm start
```

The included `Procfile` runs `npm start`. The root `prestart` script initializes the database schema, while the server starts the integrated Express and Next application on `PORT`.

For Heroku:

```bash
heroku login
heroku create your-tmp-app
heroku addons:create heroku-postgresql:essential-0
heroku config:set NODE_ENV=production PORT=3001 BASE_URL=https://your-domain.example
heroku config:set SESSION_SECRET="$(openssl rand -hex 64)"
heroku config:set ADMIN_USERNAME=... ADMIN_EMAIL=... ADMIN_PASSWORD=...
heroku config:set DATABASE_URL="$(heroku config:get DATABASE_URL)"
heroku config:set STRIPE_SECRET=sk_live_... STRIPE_PUBLISHABLE=pk_live_... STRIPE_CURRENCY=usd
heroku config:set STRIPE_WEBHOOK_SECRET=whsec_...
git push heroku main
heroku logs --tail
```

Use the host's equivalent secret and deploy commands for another platform. Confirm the application is listening on the platform-provided `PORT`.

## 4. Configure Stripe payments

### Create the webhook

In Stripe Dashboard:

1. Switch to **Test mode** first.
2. Open **Developers -> Webhooks -> Add endpoint**.
3. Set the endpoint to `https://your-domain.example/webhooks/stripe`.
4. Subscribe to `checkout.session.completed`.
5. Copy the signing secret beginning with `whsec_` into `STRIPE_WEBHOOK_SECRET`.
6. Deploy/restart the application after setting the secret.
7. Repeat in **Live mode** with the live endpoint and live signing secret before launch.

The server preserves the raw request body before JSON parsing and verifies the Stripe signature. Do not put a JSON parser or proxy that rewrites the webhook body in front of this endpoint.

### Test a purchase

1. Create or keep one marketplace item with a paid version.
2. Sign up as a normal buyer and verify the account if email verification is enabled.
3. Open the marketplace item and choose the paid version.
4. Complete a Stripe test checkout with Stripe's test card `4242 4242 4242 4242`, any future expiry, and any CVC.
5. Confirm Stripe sends `checkout.session.completed` and the transaction changes from `pending` to `completed`.
6. Confirm the buyer can download the purchased version.
7. Confirm an unpaid buyer receives `403` for a paid download.
8. Confirm the admin transaction view shows the transaction and the creator earnings calculation is updated.
9. Repeat the full test in Live mode with a real low-value product before public launch.

The marketplace records a pending transaction before checkout and only unlocks paid downloads after the verified webhook marks it completed. The success URL alone must never be treated as proof of payment.

## 5. Configure marketplace operations

### Admin workflow

1. Open `/admin/login` and sign in with the production admin credentials.
2. Open `/admin/media` and upload the company logo and landing images.
3. Select `home_slide_1`, `home_slide_2`, and `home_slide_3`; save each slot individually.
4. Confirm the landing hero background and visual strip update.
5. Open `/admin/products` and remove test or demo catalog entries.
6. Open `/admin/marketplace` and review creator submissions.
7. Approve only legitimate seller applications from `/admin/seller-applications`.
8. Review, publish, flag, or remove marketplace content from the marketplace admin pages.
9. Open `/admin/orders` and `/admin/marketplace/transactions` to reconcile commerce activity.
10. Check `/admin/messages` and `/admin/applications` daily for enquiries and tutor applications.

### Creator workflow

1. A user applies at `/marketplace/seller/apply`.
2. Admin reviews the application and approves it.
3. The approved creator uploads content at `/marketplace/upload`.
4. Content starts as draft and must be reviewed/published by admin.
5. Test both free and paid versions before promoting the listing.

## 6. Verify access and sessions

Run these checks against the production domain:

```bash
curl -I https://your-domain.example/
curl -I https://your-domain.example/marketplace
curl -I https://your-domain.example/contact
curl -I https://your-domain.example/webhooks/stripe
```

For Fly.io, the machine health check uses `/healthz` internally so the
platform can verify the process before the public HTTPS redirect is applied.

Manually verify:

- Anonymous visitors see Login/Sign up and cannot open `/admin/lms`, `/student-lms`, or `/tutor-lms`.
- Active enrolled students can open the student portal.
- Active assigned tutors/teachers can open the tutor portal.
- Admins can open `/admin/lms` and admin pages.
- Parents cannot use the student/tutor portal unless the route explicitly supports their role.
- Logging out clears the session and removes authenticated navigation on refresh.
- Two independent browser sessions do not share the logged-in actor.
- Uploaded logo and slide filenames containing spaces render successfully.

## 7. Commercial launch checklist

Do not announce the site until every item is true:

- Production domain has valid HTTPS and redirects HTTP to HTTPS.
- `SESSION_SECRET`, admin credentials, database credentials, storage credentials, email credentials, and Stripe secrets are unique production values.
- No test Stripe keys or test webhook secret are configured.
- Stripe webhook delivery is successful and signature verification is confirmed.
- A real low-value purchase has completed and downloaded correctly.
- Refund and failed-payment handling has been exercised in Stripe and reconciled by an admin.
- Database backups and restore testing are configured.
- Object storage lifecycle, access, and backup policy are configured.
- Email verification, password reset, contact form, seller application, and order email have been tested.
- Admin logo, landing images, curriculum copy, tutor content, and contact number are correct.
- Marketplace has no demo/test listings, broken thumbnails, or missing downloadable files.
- Privacy, terms, refund, and seller policies have been reviewed by the business owner.
- Monitoring, error logs, uptime checks, and Stripe webhook alerts are enabled.

## 8. Ongoing operations

Every week:

- Review marketplace drafts, reports, seller applications, transactions, and failed payments.
- Check uploads and object-storage usage.
- Review application and server logs for 4xx/5xx spikes.
- Confirm database backups are completing.

Every release:

```bash
npm ci
cd frontend && npm ci && npm run build
cd ..
npm start
```

Then repeat the smoke tests in section 6 and one Stripe test-mode checkout in a staging environment.
