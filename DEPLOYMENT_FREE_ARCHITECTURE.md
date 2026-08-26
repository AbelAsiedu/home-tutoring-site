# Production deployment architecture

The platform is prepared for a durable free-tier deployment using:

- **Application:** Koyeb or another Node-compatible host with a free web tier.
- **Database:** Neon PostgreSQL (`DATABASE_URL`). `lib/db.js` already selects PostgreSQL when `DATABASE_URL` is present.
- **Files:** Cloudflare R2. LMS assignment and submission uploads now use R2 when the R2 variables below are configured and retain a local filesystem fallback for development.

## Required production environment variables

```text
DATABASE_URL=postgresql://...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=modern-pedagogues
SESSION_SECRET=...
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
ADMIN_EMAIL=...
```

R2 objects are private. LMS files are never exposed as public object URLs; downloads pass through the authenticated `/api/lms-download` endpoint, which checks the parent/tutor/admin relationship before streaming the object.

## Upload policy

- 15 MB maximum for LMS assignment/submission files.
- PDF, Office documents, text, and common image formats only.
- Object keys are generated server-side; original filenames are sanitized.
- R2 objects use server-side AES-256 encryption.
- Local storage remains available when R2 is not configured so development and existing installations continue to work.

## Important migration note

Existing files currently stored in `uploads/` are not automatically copied to R2 by deployment. Before the first production cutover, run a one-time migration that uploads existing referenced files and replaces their database paths with `r2:<object-key>` values. Do not delete the local files until checksums have been verified against the R2 objects.

## Production gate

`.github/workflows/production-gate.yml` installs dependencies, builds the Next.js frontend, performs syntax checks, and runs `scripts/production-gate.js`. The gate should pass on the deployed configuration before the public launch is announced.
