# The Modern Pedagogues — Home Tutoring Site

This project is a minimal full-stack website for The Modern Pedagogues (a home tutoring company). It is implemented with Node.js, Express and EJS templates, and uses SQLite for storage. The site includes:

- Homepage with slideshow and featured products
- About, Contact, Apply (teacher) pages
- Curriculum page and product catalog (books)
- Cart and checkout (simulated payments: card & Momo)
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

3. Open http://localhost:3000

Admin login: username `admin`, password `password` (per specification). Admin account is also added to the `users` table on first run.

Notes & next steps

- This is a scaffold with core features. You can extend content editing, add stronger auth, integrate a real payment gateway, and improve frontend visuals.
- To reset the data, delete `data.db`.

Next.js frontend (optional)

A minimal Next.js frontend is included under `frontend/`. To run the frontend in development:

```bash
cd frontend
npm install
npm run dev
# open http://localhost:3001
```

To build a static export that Express can serve:

```bash
cd frontend
npm install
npm run build
# this will export static files to `frontend-out` at repository root
# then start the main server to serve the static files
cd ..
npm start
```

# home-tutoring-site