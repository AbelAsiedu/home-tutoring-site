# The Modern Pedagogues — Home Tutoring Site

This project is the full-stack website for The Modern Pedagogues, implemented with Node.js, Express, Next.js, and PostgreSQL/SQLite adapters. The integrated root server owns the public routes, API, sessions, marketplace, admin tools, and frontend.

## Commercial launch

Follow [GO_LIVE_RUNBOOK.md](GO_LIVE_RUNBOOK.md) for hosting, production environment variables, Stripe webhooks, marketplace verification, admin operations, backups, and the final launch checklist.

The site includes:

- Homepage with slideshow and featured products
- About, Contact, Apply (teacher) pages
- Curriculum page and product catalog (books)
- Cart, marketplace checkout, Stripe payments, and verified payment webhooks
- User signup/login and account page
- Admin panel (admin/password) to manage content, products, messages, and applications
- File upload for CVs and product images
- Cookie consent and privacy placeholders

Run locally

1. Install dependencies

```bash
cd /workspaces/home-tutoring-site
npm install
```

2. Start the server

```bash
npm start
```

3. Open http://localhost:3001

Admin login uses the `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` environment variables. Set them before starting the app.

For local development, SQLite and local uploads are supported. Production should use managed PostgreSQL, persistent object storage, production email, HTTPS, and live Stripe configuration. Do not delete `data.db` in production; use backups and migrations.
