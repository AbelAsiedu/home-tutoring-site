# Card Payment & Downloadable Content Implementation Guide

## Overview
This document describes the complete implementation of card payment processing and downloadable content functionality for the home tutoring site.

## Features Implemented

### 1. Card Payment Processing
- **Payment Methods**: Card (Stripe) and Mobile Money (MoMo)
- **Card Input**: Cart page accepts card number (simulated or real with Stripe)
- **Stripe Integration**: Optional - falls back to simulated payment if not configured
- **Order Status**: Orders marked as "completed" for card payments

### 2. Downloadable Content System
- **Product Types**: Books (downloadable) and Products (physical goods)
- **Admin Interface**: File upload for creating downloadable books
- **30-Day Access**: Downloads expire 30 days after purchase
- **Download Tracking**: Track download count per user per file

### 3. User Download Management
- **Download Library**: `/downloads` page shows all accessible downloads
- **Download Links**: `checkout-success.ejs` and `/downloads` provide download access
- **Authentication**: Only logged-in users can access their downloads
- **Expiration Alerts**: UI shows warning when downloads are about to expire

## Database Schema

### Products Table (Enhanced)
```sql
id TEXT PRIMARY KEY
title TEXT
description TEXT
price REAL
image_path TEXT
is_downloadable BOOLEAN/INTEGER
file_path TEXT
created_at TIMESTAMP
```

### Order_Downloads Table (New)
```sql
id TEXT PRIMARY KEY
order_id TEXT
product_id TEXT
user_id TEXT
file_path TEXT
download_count INTEGER DEFAULT 0
created_at TIMESTAMP
expires_at TIMESTAMP
```

## Server Routes

### Payment Routes

#### POST /checkout
- **Parameters**: `payment_method`, `card_number`, `momo_number`
- **Process**:
  1. Validates cart items
  2. Calculates total
  3. Creates order record
  4. For downloadable items: Creates order_downloads records with 30-day expiration
  5. If Stripe available: Redirects to Stripe checkout
  6. If MoMo or simulated: Shows success page immediately
- **Response**: Redirects to Stripe or renders `checkout-success.ejs`

#### GET /checkout-success
- **Query**: `order` (order ID)
- **Process**:
  1. Fetches order details
  2. Retrieves associated downloadable items
  3. Generates download links (`/download/:downloadId`)
- **Response**: Renders `checkout-success.ejs` with downloadable items list

### Download Routes

#### GET /downloads
- **Auth**: Requires user login
- **Process**:
  1. Fetches all order_downloads for current user
  2. Checks expiration status
  3. Marks expired downloads
- **Response**: Renders `downloads.ejs` with user's download library

#### GET /download/:downloadId
- **Auth**: Verifies user owns download or is admin
- **Process**:
  1. Authenticates download ownership
  2. Checks expiration (403 if expired)
  3. Increments download_count
  4. Serves file from uploads directory or redirects to URL
- **Response**: File download or 403/404 error

### Admin File Upload Routes

#### POST /admin/products
- **Middleware**: `requireAdmin`, `upload.fields([{name:'image'}, {name:'file'}])`
- **Parameters**: 
  - `title`, `description`, `price`
  - `is_downloadable` (checkbox)
  - `image` (product image file)
  - `file` (downloadable content for books)
- **Process**:
  1. Validates title
  2. Saves image to `/uploads` if provided
  3. Saves file to `/uploads` if downloadable product
  4. Stores `file_path` in products table
- **Response**: Redirects to `/admin/products` with success/error message

#### POST /admin/products/:id/update
- **Middleware**: `requireAdmin`, `upload.fields([{name:'image'}, {name:'file'}])`
- **Parameters**: Same as create, plus existing `image_path` and `file_path`
- **Process**:
  1. Updates product fields
  2. Replaces files if new ones provided
  3. Retains existing files if not updated
- **Response**: Redirects to `/admin/products` with success/error message

## File Structure

### Views
```
views/
├── checkout-success.ejs    # Order confirmation with download links
├── downloads.ejs            # User download library
└── admin/products.ejs       # Product management with file uploads
```

### Directories
```
uploads/                     # Downloadable files and product images
```

## Implementation Details

### Order Processing Flow
1. User adds items to cart
2. User goes to checkout
3. Selects payment method (Card/MoMo)
4. Provides payment details
5. System creates order
6. System creates order_downloads entries for downloadable items (30-day expiration)
7. User sees order confirmation with download links
8. User can access downloads via `/downloads` page or direct links

### Download Security
- **Authentication**: Users must be logged in to access `/downloads`
- **Authorization**: `/download/:id` verifies user ownership before serving file
- **Expiration**: Downloads expire after 30 days; expired downloads return 403 error
- **Tracking**: Download count incremented each time a user accesses the file

### File Upload Process
1. Admin visits `/admin/products`
2. Checks "Downloadable Product" checkbox for books
3. Uploads file (PDF, EPUB, ZIP supported)
4. Multer saves file with timestamp prefix: `1763290302464-filename.pdf`
5. Filename stored in products table `file_path` column
6. Files accessible only through authenticated `/download/:id` route

### Stripe Integration (Optional)
If `STRIPE_SECRET` environment variable is set:
- Creates Stripe Checkout Session
- Redirects user to Stripe payment page
- Returns to `/checkout-success` on success

Without Stripe:
- Payment is simulated
- Order shows as "completed"
- User proceeds to download immediately

## Testing the Implementation

### Test Downloadable Purchase
1. Go to `/admin/products`
2. Create new product with:
   - Title: "Test Book"
   - Price: $9.99
   - Check "Downloadable Product"
   - Upload PDF file
3. Add product to cart
4. Go to checkout
5. Select "Card" payment method
6. Complete checkout
7. Should see download link on success page

### Test Download Access
1. Login as user
2. Visit `/downloads`
3. Should see purchased books with download links
4. Click download link
5. File should download
6. Download count should increment

### Test Expiration
1. In database, manually update order_downloads `expires_at` to past date
2. Visit `/downloads`
3. Download should show as expired
4. Clicking download should return 403 error

## Configuration

### Environment Variables
```bash
# Stripe (optional)
STRIPE_SECRET=sk_test_xxxxx

# Database
DATABASE_URL=postgres://...  # Optional; uses SQLite if not set

# File Uploads
# Max file size configured in multer storage
# Upload directory: /uploads (auto-created on startup)
```

### File Type Restrictions
Currently accepts all file types. To restrict:
```javascript
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /\.(pdf|epub|zip|txt)$/i;
    cb(null, allowed.test(file.originalname));
  }
});
```

## Error Handling

### Common Scenarios
- **No cart items**: Redirects to `/cart`
- **Expired download**: Returns 403 with message
- **File not found**: Returns 404 with message
- **Unauthorized access**: Returns 403 "Access denied"
- **DB error**: Returns 500 with error message

## Performance Considerations

1. **Download Tracking**: Updates download_count on every access
2. **File Serving**: Uses Express static file serving from `/uploads`
3. **Large Files**: Consider implementing streaming for large downloads:
   ```javascript
   res.download(fullPath); // Handles streaming automatically
   ```

## Security Notes

1. **File Access**: Only authenticated users with valid order_downloads records
2. **CSRF Protection**: Cart and checkout protected by CSRF tokens
3. **Rate Limiting**: Already configured on auth routes
4. **File Upload**: Multer sanitizes filenames with timestamp prefix
5. **SQLi Prevention**: Using parameterized queries throughout

## Future Enhancements

1. **Email Delivery**: Send download link via email after purchase
2. **Download Limits**: Limit downloads to N attempts per file
3. **Regional Restrictions**: Block downloads by geographic location
4. **Analytics**: Track popular downloads, user patterns
5. **DRM**: Implement digital rights management for sensitive content
6. **Batch Downloads**: ZIP multiple items for single download
7. **Download Resume**: Support resume for large files

## Troubleshooting

### Downloads not appearing after purchase
- Check order_downloads table for entries
- Verify user_id matches logged-in user
- Check expiration date hasn't passed
- Check file_path exists in uploads directory

### File download fails
- Verify file exists in `/uploads` directory
- Check file permissions (should be readable)
- Check user authentication status
- Check order_downloads expiration

### Multer file upload not working
- Verify `/uploads` directory exists and is writable
- Check file size doesn't exceed limits
- Check Content-Type header is multipart/form-data
- Check form field name matches multer configuration

## Summary

The card payment and downloadable content system is fully integrated into the application with:
- ✅ Database schema for downloads and expiration
- ✅ Admin interface for file uploads
- ✅ Checkout process with download record creation
- ✅ User download library with expiration tracking
- ✅ Secure file serving with authentication
- ✅ Optional Stripe integration
