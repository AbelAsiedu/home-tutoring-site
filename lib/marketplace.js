// Marketplace utilities: content management, versioning, transactions, creator payouts
const { v4: uuidv4 } = require('uuid');
const { runQuery, runExec, runQueryOne } = require('./db');

// Upload & process content
async function uploadContent(creatorId, title, description, category, filePath, thumbnailPath, tags) {
  const contentId = uuidv4();
  const timestamp = new Date().toISOString();
  
  await runExec(
    `INSERT INTO marketplace_content (id, creator_id, title, description, category, file_path, thumbnail_path, status, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [contentId, creatorId, title, description, category, filePath, thumbnailPath, 'draft', tags || '', timestamp, timestamp]
  );
  
  return contentId;
}

// Add free or paid version of content
async function addContentVersion(contentId, versionType = 'free', filePath, price = 0, licenseType = 'personal') {
  const versionId = uuidv4();
  const timestamp = new Date().toISOString();
  
  await runExec(
    `INSERT INTO marketplace_versions (id, content_id, version_type, file_path, price, license_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [versionId, contentId, versionType, filePath, price, licenseType, timestamp]
  );
  
  return versionId;
}

// Create a pack (bundle of content)
async function createPack(creatorId, name, description, price, contentIds) {
  const packId = uuidv4();
  const timestamp = new Date().toISOString();
  
  await runExec(
    `INSERT INTO marketplace_packs (id, creator_id, name, description, price, content_ids, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [packId, creatorId, name, description, price, JSON.stringify(contentIds), 'draft', timestamp]
  );
  
  return packId;
}

// Get content by ID with creator info
async function getContentById(contentId) {
  const content = await runQueryOne(
    `SELECT c.*, u.name as creator_name, u.email as creator_email
     FROM marketplace_content c
     JOIN users u ON c.creator_id = u.id
     WHERE c.id = ?`,
    [contentId]
  );
  
  if (content) {
    // Get all versions
    const versions = await runQuery(
      `SELECT * FROM marketplace_versions WHERE content_id = ? ORDER BY version_type DESC`,
      [contentId]
    );
    content.versions = versions;
    
    // Get reviews
    const reviews = await runQuery(
      `SELECT r.*, u.name as reviewer_name
       FROM marketplace_reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.content_id = ?
       ORDER BY r.created_at DESC`,
      [contentId]
    );
    content.reviews = reviews;
  }
  
  if (content) return content;

  const product = await runQueryOne(
    `SELECT id, title, description, price, image_path, file_path, is_downloadable
     FROM products
     WHERE id = ?`,
    [contentId]
  );

  if (!product) return null;

  const price = Number(product.price || 0);
  const versionId = `product-${product.id}`;

  return {
    id: product.id,
    title: product.title,
    description: product.description,
    category: 'books',
    file_path: product.file_path,
    thumbnail_path: product.image_path,
    status: 'published',
    tags: '',
    rating: 0,
    rating_count: 0,
    download_count: 0,
    creator_id: 'admin-1',
    creator_name: 'Admin',
    creator_email: 'admin@local',
    source: 'products',
    versions: product.file_path ? [{
      id: versionId,
      content_id: product.id,
      version_type: price > 0 ? 'paid' : 'free',
      file_path: product.file_path,
      price,
      license_type: 'personal'
    }] : [],
    reviews: []
  };
}

// Search content with filters - includes both marketplace_content and admin products
async function searchContent(filters = {}) {
  try {
    // Query marketplace content
    let sqlMarketplace = `
      SELECT c.*, u.name as creator_name
      FROM marketplace_content c
      JOIN users u ON c.creator_id = u.id
      WHERE c.status = 'published' AND c.visibility = 'public'
    `;
    const paramsMarketplace = [];
    
    if (filters.category) {
      sqlMarketplace += ` AND c.category = ?`;
      paramsMarketplace.push(filters.category);
    }
    
    if (filters.search) {
      sqlMarketplace += ` AND (c.title LIKE ? OR c.description LIKE ? OR c.tags LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      paramsMarketplace.push(searchTerm, searchTerm, searchTerm);
    }
    
    sqlMarketplace += ` ORDER BY c.created_at DESC`;
    const marketplaceItems = await runQuery(sqlMarketplace, paramsMarketplace);
    
    // Query admin products (downloadable books)
    let sqlProducts = `
      SELECT id, title, description, price, image_path as thumbnail_path, 
             file_path, 'products' as source, 'books' as category,
             0 as rating, 0 as download_count, datetime('now') as created_at,
             'admin' as creator_id, 'Admin' as creator_name
      FROM products
      WHERE is_downloadable = 1
    `;
    const paramsProducts = [];
    
    if (filters.search) {
      sqlProducts += ` AND (title LIKE ? OR description LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      paramsProducts.push(searchTerm, searchTerm);
    } else if (filters.category && filters.category !== 'books') {
      // Skip products if filtering for non-book categories
      const adminProducts = [];
    }
    
    sqlProducts += ` ORDER BY datetime('now') DESC`;
    const adminProductsRaw = filters.category && filters.category !== 'books' ? [] : await runQuery(sqlProducts, paramsProducts);
    const adminProducts = adminProductsRaw.map(product => {
      const price = Number(product.price || 0);
      return {
        ...product,
        source: 'products',
        versions: product.file_path ? [{
          id: `product-${product.id}`,
          content_id: product.id,
          version_type: price > 0 ? 'paid' : 'free',
          file_path: product.file_path,
          price,
          license_type: 'personal'
        }] : []
      };
    });
    
    // Combine and filter by price
    let combined = [...marketplaceItems, ...adminProducts];
    
    if (filters.minPrice !== undefined) {
      combined = combined.filter(item => (item.price || 0) >= filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      combined = combined.filter(item => (item.price || 0) <= filters.maxPrice);
    }
    
    // Apply sorting
    if (filters.sortBy === 'rating') {
      combined.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (filters.sortBy === 'downloads') {
      combined.sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
    } else {
      combined.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }
    
    // Apply pagination
    const limit = filters.limit || 20;
    const offset = (filters.page || 0) * limit;
    const paginated = combined.slice(offset, offset + limit);
    
    return paginated;
  } catch (err) {
    console.error('searchContent error:', err);
    return [];
  }
}

// Record a transaction
async function createTransaction(buyerId, sellerId, contentId, packId, transactionType, amount) {
  const transactionId = uuidv4();
  const timestamp = new Date().toISOString();
  
  await runExec(
    `INSERT INTO marketplace_transactions (id, buyer_id, seller_id, content_id, pack_id, transaction_type, amount, payment_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [transactionId, buyerId, sellerId, contentId, packId, transactionType, amount, 'pending', timestamp]
  );
  
  return transactionId;
}

// Update transaction payment status
async function updateTransactionPayment(transactionId, status, stripePaymentId) {
  await runExec(
    `UPDATE marketplace_transactions SET payment_status = ?, stripe_payment_id = ? WHERE id = ?`,
    [status, stripePaymentId, transactionId]
  );
}

// Add/remove from favorites
async function toggleFavorite(userId, contentId) {
  const existing = await runQueryOne(
    `SELECT id FROM marketplace_favorites WHERE user_id = ? AND content_id = ?`,
    [userId, contentId]
  );
  
  if (existing) {
    await runExec(`DELETE FROM marketplace_favorites WHERE id = ?`, [existing.id]);
    return false; // removed
  } else {
    const favId = uuidv4();
    const timestamp = new Date().toISOString();
    await runExec(
      `INSERT INTO marketplace_favorites (id, user_id, content_id, created_at) VALUES (?, ?, ?, ?)`,
      [favId, userId, contentId, timestamp]
    );
    return true; // added
  }
}

// Add review & rating
async function addReview(contentId, userId, rating, comment) {
  const reviewId = uuidv4();
  const timestamp = new Date().toISOString();
  
  await runExec(
    `INSERT INTO marketplace_reviews (id, content_id, user_id, rating, comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [reviewId, contentId, userId, rating, comment, timestamp]
  );
  
  // Update content rating
  const reviews = await runQuery(
    `SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM marketplace_reviews WHERE content_id = ?`,
    [contentId]
  );
  
  if (reviews[0]) {
    await runExec(
      `UPDATE marketplace_content SET rating = ?, rating_count = ? WHERE id = ?`,
      [reviews[0].avg_rating || 0, reviews[0].count, contentId]
    );
  }
  
  return reviewId;
}

// Get creator's content
async function getCreatorContent(creatorId) {
  return runQuery(
    `SELECT id, title, status, created_at, download_count, rating FROM marketplace_content
     WHERE creator_id = ? ORDER BY created_at DESC`,
    [creatorId]
  );
}

// Calculate and record creator earnings for a month
async function calculateMonthlyEarnings(creatorId, year, month) {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  
  const result = await runQuery(
    `SELECT SUM(amount) as total FROM marketplace_transactions
     WHERE seller_id = ? AND payment_status = 'completed' AND DATE(created_at) LIKE ?`,
    [creatorId, `${monthStr}%`]
  );
  
  const totalEarnings = (result[0] && result[0].total) || 0;
  
  // Stripe takes 2.9% + $0.30 per transaction; platform takes 30%
  const stripeFee = totalEarnings * 0.029 + 0.30;
  const platformFee = totalEarnings * 0.30;
  const creatorPayout = totalEarnings - stripeFee - platformFee;
  
  const earningId = uuidv4();
  await runExec(
    `INSERT OR REPLACE INTO creator_earnings (id, creator_id, month, total_earnings)
     VALUES (?, ?, ?, ?)`,
    [earningId, creatorId, monthStr, creatorPayout]
  );
  
  return creatorPayout;
}

// Get creator earnings history
async function getCreatorEarnings(creatorId) {
  return runQuery(
    `SELECT * FROM creator_earnings WHERE creator_id = ? ORDER BY month DESC LIMIT 12`,
    [creatorId]
  );
}

// Publish/unpublish content
async function publishContent(contentId, status) {
  const timestamp = new Date().toISOString();
  await runExec(
    `UPDATE marketplace_content SET status = ?, updated_at = ? WHERE id = ?`,
    [status, timestamp, contentId]
  );
}

// Increment download count
async function recordDownload(contentId, userId) {
  await runExec(
    `UPDATE marketplace_content SET download_count = download_count + 1 WHERE id = ?`,
    [contentId]
  );
}

module.exports = {
  uploadContent,
  addContentVersion,
  createPack,
  getContentById,
  searchContent,
  createTransaction,
  updateTransactionPayment,
  toggleFavorite,
  addReview,
  getCreatorContent,
  calculateMonthlyEarnings,
  getCreatorEarnings,
  publishContent,
  recordDownload
};
