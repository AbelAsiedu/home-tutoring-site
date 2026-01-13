# Marketplace Guide

A Freepik-like creator marketplace where users upload, sell, and download digital content (templates, graphics, fonts, photos, videos, audio, etc.) with free and premium versions.

## Architecture

### Database Schema

**marketplace_content** - Core content records
- `id`, `creator_id`, `title`, `description`, `category`, `file_path`, `thumbnail_path`
- `status` (draft/published/flagged), `visibility` (private/public), `tags`
- `rating`, `rating_count`, `download_count`
- `created_at`, `updated_at`

**marketplace_versions** - Free and paid variants of content
- `id`, `content_id`, `version_type` (free/paid), `file_path`, `file_size`
- `price` (0 for free), `license_type` (personal/commercial/editorial)

**marketplace_packs** - Bundle multiple content items
- `id`, `creator_id`, `name`, `description`, `price`, `content_ids` (JSON array)
- `thumbnail_path`, `status` (draft/published), `created_at`

**marketplace_transactions** - Purchase records
- `id`, `buyer_id`, `seller_id`, `content_id`, `pack_id`, `transaction_type`
- `amount`, `payment_status` (pending/completed/failed), `stripe_payment_id`
- `created_at`

**marketplace_favorites** - User wishlist
- `id`, `user_id`, `content_id`, `created_at`

**marketplace_reviews** - User ratings and comments
- `id`, `content_id`, `user_id`, `rating` (1–5), `comment`, `created_at`

**creator_earnings** - Monthly payout tracking
- `id`, `creator_id`, `month` (YYYY-MM), `total_earnings`
- `payout_status` (pending/completed), `payout_date`

---

## User Flows

### For Creators

#### 1. **Upload Content**
- `GET /marketplace/upload` → Upload form
- User selects file, thumbnail, title, category, tags
- Can offer free version (watermarked/limited) and/or paid (premium)
- File stored in `/uploads/`, content record created in `draft` status

#### 2. **Manage & Publish**
- `GET /marketplace/creator/dashboard` → Creator dashboard
  - List of creator's content with stats (downloads, rating, status)
  - Button to publish draft content
- `POST /marketplace/:contentId/publish` → Set status to `published`
  - Content now visible in public browse

#### 3. **Earn from Sales**
- When user purchases paid version:
  - Stripe charge (2.9% + $0.30)
  - Platform takes 30%
  - Creator receives ~40% (configurable)
- Monthly payout calculated from `marketplace_transactions`
- Creator views earnings in dashboard (UI placeholder for now)

---

### For Buyers

#### 1. **Browse & Search**
- `GET /marketplace` → Browse all published content
  - Filters: category, price range, rating, search
  - Sort: newest, top-rated, most-downloaded
  - Grid layout with cards (preview, title, creator, rating, price)
  - Pagination: 20 per page

#### 2. **View Details**
- `GET /marketplace/:contentId` → Content detail page
  - Large preview, full description, creator info
  - Rating & reviews from other users
  - List of versions (free and paid) with prices and licenses
  - Download or purchase buttons

#### 3. **Download**
- Free version: `POST /marketplace/:contentId/download/:versionId`
  - Allowed anytime after login
  - Records download count
- Paid version: requires purchase first
  - Check if user has completed transaction
  - If not, redirect to checkout

#### 4. **Purchase & Payment**
- `POST /marketplace/:contentId/purchase/:versionId` → Stripe checkout session
  - Line item: content title, price
  - Success URL redirects to detail page with success message
  - Webhook `/webhooks/stripe` updates transaction status to `completed`

#### 5. **Review & Rate**
- Visible only to purchased/free-downloaded users
- `POST /marketplace/:contentId/review` → Add 1–5 stars and comment
- Updates content `rating` (average) and `rating_count`

#### 6. **Favorites**
- `POST /marketplace/:contentId/favorite` → Toggle favorite (heart icon)
- Stores in `marketplace_favorites`
- Users can view saved list (future feature)

---

## Admin Controls

### Marketplace Dashboard
- `GET /admin/marketplace` → Overview with stats
  - Total content, published, pending review, flagged
  - Recent content in moderation queue
  - Quick links to creators, transactions, reports

### Content Moderation
- `GET /admin/marketplace/:contentId` → Detail view with moderation panel
  - Preview, creator info, stats
  - Approve / Reject / Flag buttons
  - Notifications sent to creator after action

- `POST /admin/marketplace/:contentId/moderate` → Apply moderation action
  - **Approve:** Set status to `published` + email creator
  - **Reject:** Return to `draft` (creator can edit and resubmit)
  - **Flag:** Set status to `flagged` for manual review (spam, copyright, etc.)

### Creator Management
- `GET /admin/marketplace/creators` → List all creators
  - Name, email, content count, total downloads
  - Link to user profile for suspension if needed

### Transaction Monitoring
- `GET /admin/marketplace/transactions` → All purchases
  - Buyer, seller, content, amount, payment status, date
  - Summary stats: completed, pending, failed, total revenue
  - Used to track fraud, failed payments, disputes

---

## API Endpoints

### Public Marketplace
```
GET  /marketplace                           # Browse/search
GET  /marketplace/:contentId                # Detail
GET  /marketplace/upload                    # Upload form
POST /marketplace/upload                    # Create content
POST /marketplace/:contentId/download/:vid  # Download (free or purchased)
POST /marketplace/:contentId/purchase/:vid  # Initiate Stripe checkout
POST /marketplace/:contentId/favorite       # Toggle favorite
POST /marketplace/:contentId/review         # Add review
GET  /marketplace/creator/dashboard         # Creator dashboard (login required)
POST /marketplace/:contentId/publish        # Publish draft (creator only)
```

### Stripe Webhooks
```
POST /webhooks/stripe                       # Payment confirmed (updates transaction)
```

### Admin Only
```
GET  /admin/marketplace                     # Moderation queue
GET  /admin/marketplace/:contentId          # Review content
POST /admin/marketplace/:contentId/moderate # Approve/reject/flag
GET  /admin/marketplace/creators            # Creators list
GET  /admin/marketplace/transactions        # Transaction history
```

---

## Key Features

### Content Versioning
- **Free version:** Watermarked preview or limited variant (lower resolution, partial features)
- **Paid version:** Full, unlimited file (premium)
- One content can have both; buyers get free + option to upgrade to paid

### Monetization
- **Stripe integration:** Card payments, automatic payout splits
- **One-time purchases:** Buy individual content or packs
- **Future:** Subscriptions (monthly access to all content)

### Quality Control
- Content starts in `draft` → admin must approve → becomes `published`
- Flagged content hidden from browse until reviewed
- Creator suspension available to admin if policies violated

### Engagement
- Star ratings (1–5) + written reviews from buyers
- Download counter to show popularity
- Favorite/wishlist for future notification feature

### Creators
- Earn passive income from once-uploaded content
- Dashboard to track earnings and content performance
- Monthly payouts to verified bank accounts (Stripe Connect integration pending)

---

## Implementation Details

### File Upload
- Uses `multer` to handle multipart form data
- Files stored in `/uploads/` directory
- File path saved to database for retrieval

### Search & Filters
- Full-text search on title, description, tags
- Price range filter (free, $0–5, $5–10, $10+)
- Category filter (templates, graphics, icons, fonts, photos, vectors, videos, music)
- Sort: newest, top-rated, most-downloaded

### Marketplace Library (`lib/marketplace.js`)
- `uploadContent()` - Create content record
- `addContentVersion()` - Add free/paid variant
- `createPack()` - Bundle content
- `getContentById()` - Fetch with creator, versions, reviews
- `searchContent()` - Query with filters
- `createTransaction()` - Record purchase
- `updateTransactionPayment()` - Mark Stripe payment complete
- `toggleFavorite()` - Add/remove from favorites
- `addReview()` - Submit rating and comment
- `getCreatorContent()` - List creator's items
- `publishContent()` - Change status to published
- `recordDownload()` - Increment download counter

### Stripe Integration
- `STRIPE_SECRET` env var must be set
- Checkout sessions created per purchase
- Webhook validates payment and updates transaction
- Payment intent ID stored for refunds/disputes

---

## Configuration

### Environment Variables
```bash
STRIPE_SECRET=sk_live_...              # Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_...        # Webhook signing secret
```

### Category List (edit in views)
```javascript
['templates', 'graphics', 'icons', 'fonts', 'photos', 'vectors', 'videos', 'music', 'other']
```

### License Types (edit in views)
```javascript
['personal', 'commercial', 'editorial']
```

### Payout Split
- Platform: 30%
- Stripe fees: 2.9% + $0.30
- Creator: ~40% (can be adjusted in `calculateMonthlyEarnings()`)

---

## Future Enhancements

- [ ] Payout dashboard with bank account verification (Stripe Connect)
- [ ] Subscription model (monthly access to all content)
- [ ] Vendor analytics (traffic, conversion, refund rates)
- [ ] Bulk upload and batch processing
- [ ] Content recommendations based on download/wishlist history
- [ ] Creator badges (verified, top-seller, trending)
- [ ] Dispute resolution and refund workflow
- [ ] Watermarking engine for free versions
- [ ] CDN integration for large file delivery
- [ ] Automated spam/copyright detection

---

## Testing Checklist

**Creator Flow:**
- [ ] Upload content with free + paid versions
- [ ] Edit and publish draft
- [ ] View dashboard with stats

**Buyer Flow:**
- [ ] Search and filter content
- [ ] View detail page with versions
- [ ] Download free version
- [ ] Purchase paid version (test Stripe with `4242 4242 4242 4242`)
- [ ] Leave review and rating

**Admin Flow:**
- [ ] View moderation queue
- [ ] Approve/reject/flag content
- [ ] View creator list and earnings
- [ ] Monitor transactions and revenue

**Payments:**
- [ ] Successful purchase via Stripe
- [ ] Webhook receives payment confirmation
- [ ] Transaction status updates to `completed`
- [ ] User can download after payment

---

## Deployment Notes

- Marketplace is live at `/marketplace` (public) and `/admin/marketplace` (admin)
- No special deployment steps; database tables created on app start
- Set `STRIPE_SECRET` and `STRIPE_WEBHOOK_SECRET` on Heroku
- File uploads limited to 500 MB per file
- Thumbnails should be 1:1 aspect ratio, max 5 MB
