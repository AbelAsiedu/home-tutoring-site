const path = require('path');
const fs = require('fs');
require('dotenv').config(); // Load environment variables first
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { doubleCsrf } = require('csrf-csrf');
const { sendEmail } = require('./lib/email');
const Stripe = require('stripe');
const stripe = process.env.STRIPE_SECRET ? Stripe(process.env.STRIPE_SECRET) : null;
const next = require(path.join(__dirname, 'frontend', 'node_modules', 'next'));
const nextApp = next({ dev: process.env.NODE_ENV !== 'production', dir: path.join(__dirname, 'frontend') });
const nextHandle = nextApp.getRequestHandler();
const { initDb: initDatabase, runQuery, runQueryOne, runExec, dbRun, dbGet, dbAll, dbPrepare, getDb } = require('./lib/db');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3001;

// Security / HTTPS helpers
const USE_HTTPS = !!(process.env.SSL_KEY && process.env.SSL_CERT);
const FORCE_HTTPS = process.env.FORCE_HTTPS === 'true';
const TRUST_PROXY = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax');
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined; // allow sharing across subdomains
// In many hosting environments (Heroku, etc.) the app runs behind a proxy
// which terminates TLS. Ensure Express trusts the proxy so `req.protocol`
// and secure cookies are handled correctly. Allow explicit override via
// TRUST_PROXY env var; otherwise enable in production by default.
if (TRUST_PROXY) app.set('trust proxy', 1);
else if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// Ensure folders
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Security: Helmet middleware for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdn.tiny.cloud", "cdn.jsdelivr.net", "https://js.stripe.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.tiny.cloud", "cdn.jsdelivr.net", "fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "fonts.gstatic.com", "data:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
    },
  },
  hsts: {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true
  },
}));

// Security: Rate limiting to prevent brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// Looser limiter for admin login to reduce lockouts
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many admin login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter); // Apply to all other routes

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors({ origin: true, credentials: true }));

// Force HTTPS when behind proxy to keep secure cookies and sessions working
if (FORCE_HTTPS || process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    const forwarded = req.headers['x-forwarded-proto'];
    const isSecure = (req.connection && req.connection.encrypted) || forwarded === 'https' || req.protocol === 'https';
    if (!isSecure) {
      return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
    }
    next();
  });
}
 

// Session middleware: set secure cookie when running over HTTPS or in production
app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite' }),
  secret: process.env.SESSION_SECRET || 'very-secret-key',
  resave: false,
  saveUninitialized: false,
  proxy: true, // trust x-forwarded-proto for secure cookies
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    secure: !!(USE_HTTPS || process.env.NODE_ENV === 'production'),
    sameSite: COOKIE_SAMESITE === 'none' ? 'none' : 'lax',
    domain: COOKIE_DOMAIN || undefined
  }
}));

// Register cookie parser AFTER session (per csrf-csrf guidance)
app.use(cookieParser());

// Simple session-based CSRF protection
const crypto = require('crypto');

// Generate CSRF token for a session
function generateCsrfToken(req) {
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = crypto.randomBytes(32).toString('hex');
  }
  return crypto.createHmac('sha256', req.session.csrfSecret).update(req.sessionID).digest('hex');
}

// Verify CSRF token
function verifyCsrfToken(req) {
  const token = (req.body && req.body._csrf) || req.headers['x-csrf-token'];
  if (!token || !req.session.csrfSecret) return false;
  const expected = crypto.createHmac('sha256', req.session.csrfSecret).update(req.sessionID).digest('hex');
  return token === expected;
}

// CSRF protection middleware
const csrfProtection = (req, res, next) => {
  const csrfExempt = [
    '/signup','/login',
    '/api/cart/add','/api/cart/remove','/api/cart/clear','/api/cart','/api/session',
    '/api/products','/api/content','/api/curriculum',
    '/admin/media/upload','/admin/media/delete'
  ];
  if (csrfExempt.includes(req.path)) return next();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    if (!verifyCsrfToken(req)) {
      console.warn(`[CSRF] Token mismatch for ${req.path}. Body:`, req.body ? Object.keys(req.body) : 'no body');
      const view = req.path.includes('signup') ? 'signup' : (req.path.includes('admin') ? 'admin/login' : 'login');
      return res.status(403).render(view, { error: 'Security check failed. Please refresh and try again.', csrfToken: generateCsrfToken(req), isAdmin: false, cartItems: [] });
    }
  }
  next();
};

app.use(csrfProtection);

// Expose cart count and items to server-rendered views
app.use(async (req, res, next) => {
  try {
    // Initialize cart if not exists or invalid
    if (!req.session.cart || typeof req.session.cart !== 'object' || Array.isArray(req.session.cart)) {
      req.session.cart = {};
    }
    
    const cart = req.session.cart;
    
    // Clean up cart - remove any non-numeric or zero quantities
    Object.keys(cart).forEach(key => {
      const qty = Number(cart[key]);
      if (!qty || qty <= 0 || isNaN(qty)) {
        delete cart[key];
      } else {
        cart[key] = qty; // Ensure it's stored as number
      }
    });
    
    const ids = Object.keys(cart).filter(id => id && cart[id] > 0);
    let items = [];
    let count = 0;
    
    if (ids.length) {
      try {
        const rows = await runQuery(`SELECT * FROM products WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
        items = rows.map(r => ({ ...r, qty: cart[r.id] || 0 }));
        count = items.reduce((s, item) => s + (Number(item.qty) || 0), 0);
      } catch (dbErr) {
        console.error('Cart query error:', dbErr);
        // Clear invalid cart on error
        req.session.cart = {};
      }
    }
    
    res.locals.cartCount = count;
    res.locals.cartItems = items;
  } catch (e) {
    console.error('Cart middleware error:', e);
    req.session.cart = {};
    res.locals.cartCount = 0;
    res.locals.cartItems = [];
  }
  res.locals.isAdmin = req.session && req.session.user && req.session.user.role === 'admin';
  // Generate CSRF token for all views
  res.locals.csrfToken = generateCsrfToken(req);
  
  // Content helper function for templates
  res.locals.content = function(key, defaultValue = '') {
    if (!res.locals._contentCache) {
      res.locals._contentCache = {};
    }
    if (res.locals._contentCache[key] !== undefined) {
      return res.locals._contentCache[key];
    }
    // Return default for now - will be populated by route handlers
    return defaultValue;
  };
  
  next();
});

// Friendly CSRF error handler
app.use((err, req, res, next) => {
  try {
    console.error('[Error]', err && err.stack ? err.stack : err);
    const view = req.path && req.path.includes('signup') ? 'signup' : (req.path && req.path.includes('admin') ? 'admin/login' : 'login');
    res.status(500).render(view, { error: 'An error occurred. Please refresh and try again.', csrfToken: generateCsrfToken(req), isAdmin: false, cartItems: [] }, (renderErr, html) => {
      if (renderErr) {
        console.error('[Render Error]', renderErr);
        return res.status(500).send('Server error');
      }
      res.send(html);
    });
  } catch (e) {
    console.error('[Handler Error]', e);
    res.status(500).send('Server error');
  }
});

// Initialize database (Postgres via DATABASE_URL or fallback to SQLite)
// All schema initialization is now in lib/db.js
initDatabase();

// Seed admin user
async function seedAdminUser() {
  const adminId = 'admin-1';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@modernpedagogues.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'passwod';
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const hashedTarget = bcrypt.hashSync(adminPassword, 10);
  
  try {
    const existing = await runQueryOne('SELECT * FROM users WHERE id = ?', [adminId]);
    if (!existing) {
      await runExec('INSERT INTO users (id, name, email, password, plain_password, role) VALUES (?, ?, ?, ?, ?, ?)', 
        [adminId, 'Admin', adminEmail, hashedTarget, adminPassword, 'admin']);
      console.log(`Admin user created: username=${adminUsername}`);
    } else {
      // Update admin password
      await runExec('UPDATE users SET password = ?, plain_password = ? WHERE id = ?', 
        [hashedTarget, adminPassword, adminId]);
    }
  } catch (err) {
    console.error('Error seeding admin user:', err);
  }
}

seedAdminUser();

// Seed sample data for manual testing (only if no lessons exist)
async function seedSampleData() {
  try {
    const lessons = await runQuery('SELECT count(*) as c FROM lessons');
    if (lessons && lessons[0] && lessons[0].c < 5) {
      console.log('Seeding sample users, lesson and report for manual testing...');
      const studentId = 'student-1';
      const tutorId = 'tutor-1';
      const hashed = bcrypt.hashSync('password', 10);
      await runExec('INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING', [studentId, 'Test Student', 'student@example.com', hashed, 'user']);
      await runExec('INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING', [tutorId, 'Test Tutor', 'tutor@example.com', hashed, 'tutor']);
      await runExec('INSERT INTO teachers (id, name, email, bio, subjects) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING', [tutorId, 'Test Tutor', 'tutor@example.com', 'Experienced tutor', 'Math,Science']);
      const lessonId = uuidv4();
      const scheduled = new Date(Date.now() + 24*3600*1000).toISOString();
      await runExec('INSERT INTO lessons (id, tutor_id, student_id, scheduled_at, duration_minutes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [lessonId, tutorId, studentId, scheduled, 30, 'scheduled', new Date().toISOString()]);
      const reportId = uuidv4();
      await runExec('INSERT INTO lesson_reports (id, lesson_id, tutor_id, student_id, summary, homework, progress_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [reportId, lessonId, tutorId, studentId, 'Good progress on algebra', 'Complete worksheet 3', 7, new Date().toISOString()]);
      const recId = uuidv4();
      await runExec('INSERT INTO recordings (id, lesson_id, url, uploaded_at, notes) VALUES (?, ?, ?, ?, ?)', [recId, lessonId, null, new Date().toISOString(), 'Sample recording placeholder']);
    }
  } catch (err) {
    console.error('Seed sample data error:', err);
  }
}

// Seed demo products if none exist
async function seedDemoProducts() {
  try {
    const products = await runQuery('SELECT count(*) as c FROM products');
    if (products && products[0] && products[0].c < 5) {
      console.log('Seeding demo products for shop...');
      const demo = [
        { title: 'Primary Mathematics Workbook', description: 'Practice exercises aligned to the curriculum for Primary learners.', price: 30, image: '/images/book-primary.svg' },
        { title: 'JHS English Comprehension Pack', description: 'Reading passages and comprehension questions for JHS students.', price: 45, image: '/images/book-jhs-english.svg' },
        { title: 'SHS Science Revision Guide', description: 'Concise revision notes and past questions for SHS science subjects.', price: 60, image: '/images/book-shs-science.svg' },
        { title: 'IGCSE Maths Problem Solving', description: 'Targeted problem sets and mark schemes for IGCSE Maths.', price: 85, image: '/images/book-igcse-maths.svg' },
        { title: 'Tutor Resource Pack (Digital)', description: 'Editable worksheets, lesson plans and assessments (PDF bundle).', price: 20, image: '/images/book-tutor-pack.svg' }
      ];
      for (const p of demo) {
        const id = uuidv4();
        await runExec('INSERT INTO products (id, title, description, price, image_path) VALUES (?, ?, ?, ?, ?)', [id, p.title, p.description, p.price, p.image]);
      }
    }
  } catch (err) {
    console.error('Seed demo products error:', err);
  }
}

seedSampleData();
seedDemoProducts();

// Middleware to expose user to views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Auth middlewares
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  // if API, return 401 JSON, else redirect to login
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'unauth' });
  return res.redirect('/login');
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === role) return next();
    if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'forbidden' });
    res.status(403).send('Forbidden');
  };
}

function requireAnyRole(roles) {
  return (req, res, next) => {
    if (req.session && req.session.user && roles.includes(req.session.user.role)) return next();
    if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'forbidden' });
    res.status(403).send('Forbidden');
  };
}

// Helper: Load content into res.locals for templates
async function loadContent(res) {
  const content = await runQuery('SELECT key, value FROM site_content');
  const contentMap = {};
  content.forEach(row => {
    contentMap[row.key] = row.value;
  });
  res.locals.content = function(key, defaultValue = '') {
    const val = contentMap[key] !== undefined && contentMap[key] !== '' ? contentMap[key] : defaultValue;
    return val;
  };
}

// Helper: convert rows to CSV string
function toCSV(rows){
  if (!rows || !rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v)=>{
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return '"' + s + '"';
  };
  const lines = [headers.join(',')];
  rows.forEach(r=>{
    lines.push(headers.map(h=>escape(r[h])).join(','));
  });
  return lines.join(os.EOL);
}

// Routes
app.get('/', async (req, res) => {
  await loadContent(res);
  const slides = await runQuery("SELECT key, value FROM site_content WHERE key LIKE 'slide_%' ORDER BY key");
  const products = await runQuery('SELECT * FROM products LIMIT 6');
  res.render('home', { slides, products });
});

app.get('/about', async (req, res) => {
  await loadContent(res);
  const about = await runQuery('SELECT value FROM site_content WHERE key = ?', ['about_text']);
  res.render('about', { about: about[0] ? about[0].value : null });
});

app.get('/contact', (req, res) => {
  res.render('contact');
});
app.post('/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  const id = uuidv4();
  const created = new Date().toISOString();
  dbRun('INSERT INTO messages (id, name, email, subject, message, created_at) VALUES (?, ?, ?, ?, ?, ?)', [id, name, email, subject, message, created]);
  res.render('contact', { success: true });
});

app.get('/apply', (req, res) => {
  res.render('apply');
});
app.post('/apply', upload.single('cv'), (req, res) => {
  const { name, email, phone, message } = req.body;
  const cv_path = req.file ? `/uploads/${path.basename(req.file.path)}` : null;
  const id = uuidv4();
  const created = new Date().toISOString();
  dbRun('INSERT INTO applications (id, name, email, phone, message, cv_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, name, email, phone, message, cv_path, created]);
  res.render('apply', { success: true });
});

app.get('/curriculum', async (req, res) => {
  // For demo, read curricula from site_content keys curriculum_*
  const curr = await runQuery("SELECT key, value FROM site_content WHERE key LIKE 'curriculum_%'");
  const products = await runQuery('SELECT * FROM products');
  res.render('curriculum', { curr, products });
});

app.get('/tutors', async (req, res) => {
  await loadContent(res);
  res.render('tutors');
});

app.get('/faq', async (req, res) => {
  await loadContent(res);
  res.render('faq');
});

app.get('/privacy', (req, res) => {
  res.render('privacy');
});
app.get('/terms', (req, res) => {
  res.render('terms');
});

// Email verification route
app.get('/verify/:token', async (req, res) => {
  const { token } = req.params;
  
  try {
    const user = await runQuery('SELECT * FROM users WHERE verification_token = ?', [token]);
    
    if (!user || user.length === 0) {
      return res.render('login', { error: 'Invalid or expired verification token' });
    }
    
    await runQuery('UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?', [user[0].id]);
    
    // Update session if user is logged in
    if (req.session.user && req.session.user.id === user[0].id) {
      req.session.user.email_verified = true;
    }
    
    res.render('login', { success: 'Email verified successfully! You can now log in.' });
  } catch (err) {
    console.error('Verification error:', err);
    res.render('login', { error: 'Verification failed. Please try again.' });
  }
});

// Forgot password routes
app.get('/forgot-password', (req, res) => res.render('forgot-password'));

app.post('/forgot-password', [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('forgot-password', { error: errors.array()[0].msg });
  }
  
  const { email } = req.body;
  
  try {
    const user = await runQuery('SELECT * FROM users WHERE email = ?', [email]);
    
    if (user && user.length > 0) {
      const resetToken = uuidv4();
      const expiry = Date.now() + 3600000; // 1 hour from now
      
      await runQuery('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?', 
        [resetToken, expiry, user[0].id]);
      
      const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
      await sendEmail(email, 'passwordReset', {
        name: user[0].name,
        resetUrl
      });
    }
    
    // Always show success to prevent email enumeration
    res.render('forgot-password', { 
      success: 'If an account exists with that email, a password reset link has been sent.' 
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.render('forgot-password', { 
      error: 'An error occurred. Please try again later.' 
    });
  }
});

// Reset password routes
app.get('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  
  try {
    const user = await runQuery(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > ?', 
      [token, Date.now()]
    );
    
    if (!user || user.length === 0) {
      return res.render('login', { error: 'Invalid or expired reset token' });
    }
    
    res.render('reset-password', { token });
  } catch (err) {
    console.error('Reset password error:', err);
    res.render('login', { error: 'An error occurred. Please try again.' });
  }
});

app.post('/reset-password/:token', [
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('reset-password', { 
      token: req.params.token, 
      error: errors.array()[0].msg 
    });
  }
  
  const { token } = req.params;
  const { password } = req.body;
  
  try {
    const user = await runQuery(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > ?', 
      [token, Date.now()]
    );
    
    if (!user || user.length === 0) {
      return res.render('login', { error: 'Invalid or expired reset token' });
    }
    
    const hashed = bcrypt.hashSync(password, 10);
    await runQuery(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
      [hashed, user[0].id]
    );
    
    res.render('login', { success: 'Password reset successfully! You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.render('reset-password', { 
      token: req.params.token,
      error: 'An error occurred. Please try again.' 
    });
  }
});

// JSON APIs for Next.js frontend
app.get('/api/products', async (req, res) => {
  try {
    const products = await runQuery('SELECT * FROM products');
    res.json(products);
  } catch (e) { res.status(500).json({ error: 'db' }); }
});

app.get('/api/content/:key', async (req, res) => {
  try {
    const rows = await runQuery('SELECT value FROM site_content WHERE key = ?', [req.params.key]);
    res.json({ value: rows[0] ? rows[0].value : null });
  } catch (e) { res.status(500).json({ error: 'db' }); }
});

app.get('/api/curriculum', async (req, res) => {
  try {
    const curr = await runQuery("SELECT key, value FROM site_content WHERE key LIKE 'curriculum_%'");
    res.json(curr);
  } catch (e) { res.status(500).json({ error: 'db' }); }
});

app.get('/api/session', (req, res) => {
  res.json({ user: req.session.user || null, cart: req.session.cart || {} });
});

app.post('/api/cart/add', (req, res) => {
  const { id } = req.body;
  const qty = parseInt(req.body.qty || req.body.quantity || 1, 10) || 1;
  if (!req.session.cart) req.session.cart = {};
  req.session.cart[id] = (req.session.cart[id] || 0) + qty;
  res.json({ cart: req.session.cart });
});

// Remove an item from cart (API)
app.post('/api/cart/remove', (req, res) => {
  const { id } = req.body;
  if (!req.session.cart) return res.json({ cart: {} });
  delete req.session.cart[id];
  res.json({ cart: req.session.cart });
});

// Clear the cart entirely (API)
app.post('/api/cart/clear', (req, res) => {
  req.session.cart = {};
  res.json({ cart: {} });
});

app.get('/api/cart', async (req, res) => {
  try {
    const cart = req.session.cart || {};
    const ids = Object.keys(cart);
    if (!ids.length) return res.json([]);
    const rows = await runQuery(`SELECT * FROM products WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
    const items = rows.map(r => ({ ...r, qty: cart[r.id] || 0 }));
    res.json(items);
  } catch (e) { res.status(500).json({ error: 'db' }); }
});

app.post('/api/checkout', (req, res) => {
  const { payment_method, momo_number, card_number } = req.body;
  // Allow client to pass explicit items (fallback for clients without session persistence)
  const clientItems = req.body.items || null;
  const cart = req.session.cart || {};
  const ids = clientItems ? clientItems.map(i => i.id) : Object.keys(cart);
  if (!ids.length) return res.status(400).json({ error: 'empty_cart' });
  dbAll(`SELECT * FROM products WHERE id IN (${ids.map(()=>'?').join(',')})`, ids, async (err, rows) => {
    if (err) return res.status(500).json({ error: 'db' });
    let total = 0;
    const items = rows.map(r => {
      const qty = clientItems ? (clientItems.find(it=>it.id===r.id)?.qty || 0) : (cart[r.id] || 0);
      total += r.price * qty;
      return { id: r.id, title: r.title, price: r.price, qty };
    });
    const id = uuidv4();
    const created = new Date().toISOString();
    const card_last4 = card_number ? card_number.slice(-4) : null;
    dbRun('INSERT INTO orders (id, user_id, items, total, payment_method, momo_number, card_last4, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, req.session.user ? req.session.user.id : null, JSON.stringify(items), total, payment_method, momo_number, card_last4, created]);
    if (payment_method === 'card' && stripe) {
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: items.map(it => ({ price_data: { currency: 'usd', product_data: { name: it.title }, unit_amount: Math.round(it.price * 100) }, quantity: it.qty })),
          mode: 'payment',
          success_url: `${req.protocol}://${req.get('host')}/checkout-success?order=${id}`,
          cancel_url: `${req.protocol}://${req.get('host')}/cart`
        });
        req.session.cart = {};
        return res.json({ stripeUrl: session.url });
      } catch (e) { console.error(e); return res.status(500).json({ error: 'stripe' }); }
    }
    req.session.cart = {};
    res.json({ orderId: id });
  });
});

// --- Parental dashboard & lesson/reporting APIs ---

// Create a lesson booking (student or parent)
app.post('/api/lessons', requireAuth, (req, res) => {
  try {
    const { tutor_id, student_id, scheduled_at, duration_minutes } = req.body;
    const id = uuidv4();
    const created = new Date().toISOString();
    dbRun('INSERT INTO lessons (id, tutor_id, student_id, scheduled_at, duration_minutes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, tutor_id || null, student_id || (req.session.user ? req.session.user.id : null), scheduled_at || null, duration_minutes || 30, 'scheduled', created], (err) => {
      if (err) return res.status(500).json({ error: 'db' });
      res.json({ id, tutor_id, student_id, scheduled_at, duration_minutes });
    });
  } catch (e) { res.status(500).json({ error: 'server' }); }
});

// List lessons for a user (student or tutor)
app.get('/api/lessons', async (req, res) => {
  try {
    const { user_id, role } = req.query; // optional
    if (user_id) {
      const rows = await runQuery('SELECT * FROM lessons WHERE student_id = ? OR tutor_id = ? ORDER BY scheduled_at DESC', [user_id, user_id]);
      return res.json(rows);
    }
    // fallback to session user
    if (req.session.user) {
      const uid = req.session.user.id;
      const rows = await runQuery('SELECT * FROM lessons WHERE student_id = ? OR tutor_id = ? ORDER BY scheduled_at DESC', [uid, uid]);
      return res.json(rows);
    }
    res.json([]);
  } catch (e) { res.status(500).json({ error: 'db' }); }
});

// Get lesson details + reports
app.get('/api/lessons/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const lessons = await runQuery('SELECT * FROM lessons WHERE id = ?', [id]);
    if (!lessons.length) return res.status(404).json({ error: 'not_found' });
    const lesson = lessons[0];
    const reports = await runQuery('SELECT * FROM lesson_reports WHERE lesson_id = ? ORDER BY created_at DESC', [id]);
    const recs = await runQuery('SELECT * FROM recordings WHERE lesson_id = ? ORDER BY uploaded_at DESC', [id]);
    res.json({ lesson, reports, recordings: recs });
  } catch (e) { res.status(500).json({ error: 'db' }); }
});

// Tutor posts a lesson report (tutor or admin)
app.post('/api/lessons/:id/report', requireAnyRole(['tutor','admin']), async (req, res) => {
  try {
    const lesson_id = req.params.id;
    const lessonRows = await runQuery('SELECT * FROM lessons WHERE id = ?', [lesson_id]);
    if (!lessonRows.length) return res.status(404).json({ error: 'lesson_not_found' });
    const lesson = lessonRows[0];
    const currentUser = req.session.user || null;
    // If user is tutor, ensure they match the lesson.tutor_id
    if (currentUser && currentUser.role === 'tutor' && lesson.tutor_id && lesson.tutor_id !== currentUser.id) {
      return res.status(403).json({ error: 'forbidden_tutor_mismatch' });
    }
    const { summary, homework, progress_score } = req.body;
    const tutor_id = currentUser ? currentUser.id : null;
    const id = uuidv4();
    const created = new Date().toISOString();
    dbRun('INSERT INTO lesson_reports (id, lesson_id, tutor_id, student_id, summary, homework, progress_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, lesson_id, tutor_id, lesson.student_id || null, summary || null, homework || null, progress_score || null, created], (err) => {
      if (err) return res.status(500).json({ error: 'db' });
      res.json({ id });
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server' }); }
});

// Upload a recording (admin/tutor) - accepts file upload via form-data
app.post('/api/lessons/:id/recording', requireAnyRole(['tutor','admin']), upload.single('recording'), async (req, res) => {
  try {
    const lesson_id = req.params.id;
    const lessonRows = await runQuery('SELECT * FROM lessons WHERE id = ?', [lesson_id]);
    if (!lessonRows.length) return res.status(404).json({ error: 'lesson_not_found' });
    const lesson = lessonRows[0];
    const currentUser = req.session.user || null;
    if (currentUser && currentUser.role === 'tutor' && lesson.tutor_id && lesson.tutor_id !== currentUser.id) {
      return res.status(403).json({ error: 'forbidden_tutor_mismatch' });
    }
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    const url = `/uploads/${path.basename(req.file.path)}`;
    const id = uuidv4();
    const uploaded_at = new Date().toISOString();
    const notes = req.body.notes || null;
    dbRun('INSERT INTO recordings (id, lesson_id, url, uploaded_at, notes) VALUES (?, ?, ?, ?, ?)', [id, lesson_id, url, uploaded_at, notes], (err) => {
      if (err) return res.status(500).json({ error: 'db' });
      // also attach to lesson record
      dbRun('UPDATE lessons SET recording_url = ? WHERE id = ?', [url, lesson_id]);
      res.json({ id, url });
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server' }); }
});

// Parent dashboard aggregate: upcoming lessons, recent reports, recordings
app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const uid = req.query.user_id || (req.session.user ? req.session.user.id : null);
    if (!uid) return res.status(401).json({ error: 'unauth' });
    const upcoming = await runQuery('SELECT * FROM lessons WHERE student_id = ? AND status = ? ORDER BY scheduled_at ASC', [uid, 'scheduled']);
    const recentReports = await runQuery('SELECT * FROM lesson_reports WHERE student_id = ? ORDER BY created_at DESC LIMIT 6', [uid]);
    const recentRecs = await runQuery('SELECT r.* FROM recordings r JOIN lessons l ON r.lesson_id = l.id WHERE l.student_id = ? ORDER BY r.uploaded_at DESC LIMIT 6', [uid]);
    res.json({ upcoming, recentReports, recentRecordings: recentRecs });
  } catch (e) { res.status(500).json({ error: 'db' }); }
});

// JSON API endpoints for frontend apps
app.get('/api/products', (req, res) => {
  dbAll('SELECT * FROM products', (err, rows) => {
    if (err) return res.status(500).json({ error: 'db' });
    res.json(rows);
  });
});

app.get('/api/content/:key', (req, res) => {
  const key = req.params.key;
  dbGet('SELECT value FROM site_content WHERE key = ?', [key], (err, row) => {
    if (err) return res.status(500).json({ error: 'db' });
    res.json({ key, value: row ? row.value : null });
  });
});

app.get('/api/curriculum', (req, res) => {
  dbAll("SELECT key, value FROM site_content WHERE key LIKE 'curriculum_%'", (err, rows) => {
    if (err) return res.status(500).json({ error: 'db' });
    res.json(rows);
  });
});

// NOTE: `/api/session` and `/api/cart/add` are defined earlier (for API clients).
// The earlier definitions return both `user` and `cart` and accept quantity.
// Keep those first definitions and do not redeclare them here to avoid
// inconsistent responses between server-rendered and Next.js frontends.

// Products API
app.post('/admin/products', requireAdmin, upload.single('image'), (req, res) => {
  const { title, description, price } = req.body;
  if (!title) return res.redirect('/admin/products?error=' + encodeURIComponent('Title is required'));
  const priceNum = isNaN(parseFloat(price)) ? 0 : parseFloat(price);
  const image_path = req.file ? `/uploads/${path.basename(req.file.path)}` : null;
  const id = uuidv4();
  dbRun('INSERT INTO products (id, title, description, price, image_path) VALUES (?, ?, ?, ?, ?)', [id, title.trim(), description || '', priceNum, image_path], (err)=>{
    if (err) return res.redirect('/admin/products?error=' + encodeURIComponent('Database error while creating product'));
    res.redirect('/admin/products?message=' + encodeURIComponent('Product added'));
  });
});

// Simple cart in session
app.post('/cart/add', (req, res) => {
  const { id } = req.body;
  const qty = parseInt(req.body.qty || req.body.quantity || 1, 10) || 1;
  if (!req.session.cart) req.session.cart = {};
  req.session.cart[id] = (req.session.cart[id] || 0) + qty;
  res.redirect('back');
});

app.post('/cart/remove', (req, res) => {
  const { id } = req.body;
  if (!req.session.cart) return res.redirect('back');
  delete req.session.cart[id];
  res.redirect('back');
});

app.post('/cart/clear', (req, res) => {
  req.session.cart = {};
  res.redirect('back');
});

app.get('/cart/clear', (req, res) => {
  req.session.cart = {};
  res.redirect('/');
});

app.get('/cart', async (req, res) => {
  const cart = req.session.cart || {};
  const ids = Object.keys(cart);
  let items = [];
  if (ids.length) {
    const rows = await runQuery(`SELECT * FROM products WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
    items = rows.map(r => ({ ...r, qty: cart[r.id] || 0 }));
  }
  res.render('cart', { items });
});

app.post('/checkout', (req, res) => {
  const { payment_method, momo_number, card_number } = req.body;
  const cart = req.session.cart || {};
  const ids = Object.keys(cart);
  if (!ids.length) return res.redirect('/cart');
  dbAll(`SELECT * FROM products WHERE id IN (${ids.map(()=>'?').join(',')})`, ids, async (err, rows) => {
    if (err) return res.status(500).send('DB error');
    let total = 0;
    const items = rows.map(r => {
      const qty = cart[r.id] || 0; total += r.price * qty; return { id: r.id, title: r.title, price: r.price, qty };
    });
    const id = uuidv4();
    const created = new Date().toISOString();
    const card_last4 = card_number ? card_number.slice(-4) : null;
    // If payment_method is 'card' and stripe available, create a Stripe Checkout session
    dbRun('INSERT INTO orders (id, user_id, items, total, payment_method, momo_number, card_last4, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, req.session.user ? req.session.user.id : null, JSON.stringify(items), total, payment_method, momo_number, card_last4, created]);
    if (payment_method === 'card' && stripe) {
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: items.map(it => ({ price_data: { currency: 'usd', product_data: { name: it.title }, unit_amount: Math.round(it.price * 100) }, quantity: it.qty })),
          mode: 'payment',
          success_url: `${req.protocol}://${req.get('host')}/checkout-success?order=${id}`,
          cancel_url: `${req.protocol}://${req.get('host')}/cart`
        });
        req.session.cart = {};
        return res.redirect(session.url);
      } catch (e) {
        console.error('Stripe error', e);
        return res.status(500).send('Payment error');
      }
    }

    // For Momo or card without stripe, mark order as pending and show success page
    req.session.cart = {};
    res.render('checkout-success', { orderId: id });
  });
});

// Admin: list and manage orders
app.get('/admin/orders', requireAdmin, (req, res) => {
  dbAll('SELECT * FROM orders ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).send('DB error');
    res.render('admin/orders', { orders: rows });
  });
});

app.post('/admin/orders/:id/status', requireAdmin, (req, res) => {
  const id = req.params.id; const { status } = req.body;
  dbRun('UPDATE orders SET status = ? WHERE id = ?', [status, id], (err) => {
    if (err) return res.status(500).send('DB error');
    res.redirect('/admin/orders');
  });
});

// Auth: signup & login
app.get('/signup', (req, res) => {
  res.render('signup');
});
app.post('/signup', authLimiter, [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('acceptTerms').equals('on').withMessage('You must accept the Terms of Service'),
  body('acceptPrivacy').equals('on').withMessage('You must accept the Privacy Policy')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('signup', { error: errors.array()[0].msg });
  }
  
  const { name, email, password } = req.body;
  const id = uuidv4();
  const hashed = bcrypt.hashSync(password, 10);
  const verificationToken = uuidv4();
  
  dbRun('INSERT INTO users (id, name, email, password, email_verified, verification_token) VALUES (?, ?, ?, ?, 0, ?)', 
    [id, name, email, hashed, verificationToken], async (err) => {
    if (err) return res.render('signup', { error: 'Email already in use' });
    
    // Send verification email
    try {
      const verificationUrl = `${req.protocol}://${req.get('host')}/verify/${verificationToken}`;
      await sendEmail(email, 'verification', {
        name,
        verificationUrl
      });
      res.redirect('/login?success=' + encodeURIComponent('Account created. Check your email to verify, then log in.'));
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      res.redirect('/login?error=' + encodeURIComponent('Account created but failed to send verification email. Please log in and try verifying again.'));
    }
  });
});

app.get('/login', (req, res) => {
  res.render('login');
});
app.post('/login', authLimiter, [
  body('email').trim().notEmpty().withMessage('Email or username is required'),
  body('password').notEmpty().withMessage('Password is required')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('login', { error: errors.array()[0].msg });
  }
  
  const { email, password } = req.body;
  dbGet('SELECT * FROM users WHERE email = ? OR name = ?', [email, email], (err, user) => {
    if (err || !user) return res.render('login', { error: 'Invalid credentials' });
    if (!bcrypt.compareSync(password, user.password)) return res.render('login', { error: 'Invalid credentials' });
    req.session.user = { 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role || 'user',
      email_verified: user.email_verified || false
    };
    // Redirect based on role
    const finish = () => {
      if (user.role === 'admin') return res.redirect('/admin');
      if (user.role === 'tutor') return res.redirect('/tutor/lessons');
      res.redirect('/dashboard');
    };
    req.session.save((err)=>{
      if (err) console.error('Session save error (login):', err);
      finish();
    });
  });
});

app.get('/logout', (req, res) => { req.session.destroy(()=>res.redirect('/')); });

// User dashboard (server-rendered)
app.get('/dashboard', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  try {
    const upcoming = await runQuery('SELECT * FROM lessons WHERE student_id = ? AND status = ? ORDER BY scheduled_at ASC', [req.session.user.id, 'scheduled']);
    const recentReports = await runQuery('SELECT * FROM lesson_reports WHERE student_id = ? ORDER BY created_at DESC LIMIT 6', [req.session.user.id]);
    const recentRecs = await runQuery('SELECT r.* FROM recordings r JOIN lessons l ON r.lesson_id = l.id WHERE l.student_id = ? ORDER BY r.uploaded_at DESC LIMIT 6', [req.session.user.id]);
    res.render('dashboard', { user: req.session.user, upcoming, recentReports, recentRecordings: recentRecs, message: req.query.message, error: req.query.error });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.render('dashboard', { user: req.session.user, upcoming: [], recentReports: [], recentRecordings: [], error: 'Could not load dashboard' });
  }
});

app.get('/account', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('account', { 
    message: req.query.message,
    error: req.query.error,
    success: req.query.success 
  });
});

// Account management routes
app.post('/account/change-email', [
  body('newEmail').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.redirect('/account?error=' + encodeURIComponent(errors.array()[0].msg));
  }
  
  const { newEmail, password } = req.body;
  const userId = req.session.user.id;
  
  try {
    const user = await runQuery('SELECT * FROM users WHERE id = ?', [userId]);
    
    if (!user || user.length === 0) {
      return res.redirect('/account?error=User not found');
    }
    
    const match = bcrypt.compareSync(password, user[0].password);
    if (!match) {
      return res.redirect('/account?error=Incorrect password');
    }
    
    // Check if email already exists
    const existing = await runQuery('SELECT * FROM users WHERE email = ? AND id != ?', [newEmail, userId]);
    if (existing && existing.length > 0) {
      return res.redirect('/account?error=Email already in use');
    }
    
    await runQuery('UPDATE users SET email = ?, email_verified = 0 WHERE id = ?', [newEmail, userId]);
    req.session.user.email = newEmail;
    req.session.user.email_verified = false;
    
    res.redirect('/account?success=Email updated successfully. Please verify your new email.');
  } catch (err) {
    console.error('Change email error:', err);
    res.redirect('/account?error=An error occurred. Please try again.');
  }
});

app.post('/account/change-password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
], async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.redirect('/account?error=' + encodeURIComponent(errors.array()[0].msg));
  }
  
  const { currentPassword, newPassword } = req.body;
  const userId = req.session.user.id;
  
  try {
    const user = await runQuery('SELECT * FROM users WHERE id = ?', [userId]);
    
    if (!user || user.length === 0) {
      return res.redirect('/account?error=User not found');
    }
    
    const match = bcrypt.compareSync(currentPassword, user[0].password);
    if (!match) {
      return res.redirect('/account?error=Current password is incorrect');
    }
    
    const hashed = bcrypt.hashSync(newPassword, 10);
    await runQuery('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
    
    res.redirect('/account?success=Password updated successfully');
  } catch (err) {
    console.error('Change password error:', err);
    res.redirect('/account?error=An error occurred. Please try again.');
  }
});

// Admin routes
function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  // allow login using username admin and password password (per spec) as form fields
  res.redirect('/admin/login');
}

app.get('/admin/login', (req, res) => res.render('admin/login', { cartItems: [] }));
app.post('/admin/login', adminLimiter, async (req, res) => {
  try {
    const usernameRaw = (req.body.username || '').trim();
    const password = req.body.password || '';
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'passwod'; // keep in sync with bootstrap reset
    const adminPasswordFallbacks = [adminPassword, 'passwod']; // allow default even if env is stale
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@modernpedagogues.com';

    // Path 1: explicit env credentials match
    if (usernameRaw === adminUsername || usernameRaw === adminEmail) {
      if (adminPasswordFallbacks.includes(password)) {
        const userRows = await runQuery('SELECT * FROM users WHERE role = ? LIMIT 1', ['admin']).catch(err => {
          console.error('DB query error:', err);
          return [];
        });
        const user = userRows && userRows[0];
        req.session.user = user ? { id: user.id, name: user.name, email: user.email, role: 'admin' } : { id: 'admin-1', name: 'Admin', email: adminEmail, role: 'admin' };
        return req.session.save((err) => {
          if (err) console.error('Session save error:', err);
          res.redirect('/admin');
        });
      }
    }

    // Path 2: match stored admin by provided username/email
    const dbAdmins = await runQuery('SELECT * FROM users WHERE role = ?', ['admin']).catch(err => {
      console.error('DB query error:', err);
      return [];
    });
    const targetAdmin = (dbAdmins || []).find(a => a && (a.name === usernameRaw || a.email === usernameRaw || a.id === 'admin-1' || usernameRaw === adminUsername));
    if (targetAdmin) {
      const passMatch = bcrypt.compareSync(password, targetAdmin.password || '') || (targetAdmin.plain_password && targetAdmin.plain_password === password);
      if (passMatch) {
        req.session.user = { id: targetAdmin.id, name: targetAdmin.name, email: targetAdmin.email, role: 'admin' };
        return req.session.save((err) => {
          if (err) console.error('Session save error:', err);
          res.redirect('/admin');
        });
      }
    }

    return res.render('admin/login', { error: 'Invalid admin credentials', cartItems: [] });
  } catch (e) {
    console.error('Admin login error', e);
    return res.render('admin/login', { error: 'Server error. Please try again.', cartItems: [] });
  }
});

app.get('/admin', requireAdmin, async (req, res) => {
  try {
    const users = await runQuery('SELECT count(*) as c FROM users');
    const products = await runQuery('SELECT count(*) as c FROM products');
    const orders = await runQuery('SELECT count(*) as c FROM orders');
    const messages = await runQuery('SELECT count(*) as c FROM messages');
    res.render('admin/dashboard', { stats: { users: (users[0] && users[0].c) || 0, products: (products[0] && products[0].c) || 0, orders: (orders[0] && orders[0].c) || 0, messages: (messages[0] && messages[0].c) || 0 } });
  } catch (e) {
    console.error('Admin dashboard error', e);
    res.render('admin/dashboard', { stats: { users: 0, products: 0, orders: 0, messages: 0 } });
  }
});

// Admin metrics: last 14 days counts for charts
app.get('/admin/metrics', requireAdmin, async (req, res) => {
  try {
    const days = 14;
    const start = new Date();
    start.setDate(start.getDate() - (days-1));
    const fmtDate = (d)=> d.toISOString().slice(0,10);
    const labels = [];
    for (let i=0;i<days;i++){
      const d = new Date(start);
      d.setDate(start.getDate()+i);
      labels.push(fmtDate(d));
    }
    const rowsOrders = await runQuery('SELECT created_at FROM orders');
    const rowsMsgs = await runQuery('SELECT created_at FROM messages');
    const rowsApps = await runQuery('SELECT created_at FROM applications');
    const countByDay = (rows)=>{
      const map = Object.fromEntries(labels.map(l=>[l,0]));
      rows.forEach(r=>{
        const day = (r.created_at||'').slice(0,10);
        if (map[day] != null) map[day]++;
      });
      return labels.map(l=>map[l]);
    };
    res.json({ labels, orders: countByDay(rowsOrders), messages: countByDay(rowsMsgs), applications: countByDay(rowsApps) });
  } catch (e) {
    console.error('metrics error', e);
    res.status(500).json({ error: 'metrics_failed' });
  }
});

app.get('/admin/messages', requireAdmin, async (req, res) => {
  const messages = await runQuery('SELECT * FROM messages ORDER BY created_at DESC');
  res.render('admin/messages', { messages });
});

app.get('/admin/applications', requireAdmin, async (req, res) => {
  const apps = await runQuery('SELECT * FROM applications ORDER BY created_at DESC');
  res.render('admin/applications', { apps });
});

app.get('/admin/products', requireAdmin, async (req, res) => {
  const products = await runQuery('SELECT * FROM products');
  const message = req.query.message || '';
  const error = req.query.error || '';
  res.render('admin/products', { products, message, error });
});

// Admin: update product
app.post('/admin/products/:id/update', requireAdmin, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { title, description, price, image_path } = req.body;
  if (!title) return res.redirect('/admin/products?error=' + encodeURIComponent('Title is required'));
  const priceNum = isNaN(parseFloat(price)) ? 0 : parseFloat(price);
  const uploadedPath = req.file ? `/uploads/${path.basename(req.file.path)}` : null;
  const finalImage = uploadedPath || image_path || null;
  dbRun('UPDATE products SET title = ?, description = ?, price = ?, image_path = ? WHERE id = ?', [title.trim(), description || '', priceNum, finalImage, id], (err)=>{
    if (err) return res.redirect('/admin/products?error=' + encodeURIComponent('Database error while updating'));
    res.redirect('/admin/products?message=' + encodeURIComponent('Product updated'));
  });
});

// Admin: delete product
app.post('/admin/products/:id/delete', requireAdmin, (req, res) => {
  const { id } = req.params;
  dbRun('DELETE FROM products WHERE id = ?', [id], (err)=>{
    if (err) return res.redirect('/admin/products?error=' + encodeURIComponent('Database error while deleting'));
    res.redirect('/admin/products?message=' + encodeURIComponent('Product deleted'));
  });
});

app.get('/admin/content', requireAdmin, async (req, res) => {
  const entries = await runQuery('SELECT key, value FROM site_content');
  const { message, error } = req.query;
  res.render('admin/content', { entries: entries || [], message, error });
});

app.post('/admin/content', requireAdmin, (req, res) => {
  const { key, value, redirect_to } = req.body;
  const wantsJson = (req.headers.accept || '').includes('application/json') || req.xhr;
  const redirectPath = redirect_to || '/admin/content';
  dbRun('INSERT INTO site_content (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value', [key, value], (err)=>{
    if (err) {
      if (wantsJson) return res.status(500).json({ success: false, error: 'db' });
      return res.redirect(redirectPath + '?error=' + encodeURIComponent('Failed to save content'));
    }
    if (wantsJson) return res.json({ success: true });
    res.redirect(redirectPath + '?message=' + encodeURIComponent('Content saved: ' + key));
  });
});

// Admin: delete a content entry
app.post('/admin/content/delete', requireAdmin, (req, res) => {
  const { key } = req.body;
  if (!key) return res.redirect('/admin/content');
  dbRun('DELETE FROM site_content WHERE key = ?', [key], (err)=>{
    if (err) return res.status(500).send('DB error');
    res.redirect('/admin/content');
  });
});

// Bulk update content entries for Page HTML mode
app.post('/admin/content/bulk', requireAdmin, (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: 'no_items' });
    const stmt = dbPrepare('INSERT INTO site_content (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value');
    const promises = items.map(it => stmt.run([it.key, it.value || '']));
    Promise.all(promises).then(()=>{
      stmt.finalize((err) => {
        if (err) {
          console.error('DB finalize error', err);
          return res.status(500).json({ error: 'db' });
        }
        res.json({ success: true, updated: items.length });
      });
    }).catch((err)=>{
      console.error('Bulk content update error', err);
      res.status(500).json({ error: 'db' });
    });
  } catch (e) {
    console.error('Bulk content update error', e);
    res.status(500).json({ error: 'server' });
  }
});

// Admin user management
app.get('/admin/users', requireAdmin, async (req, res) => {
  const users = await runQuery('SELECT id, name, email, COALESCE(plain_password, password) as password, role FROM users ORDER BY name');
  const { message, error } = req.query;
  res.render('admin/users', { users, message, error });
});

app.post('/admin/users/create', requireAdmin, [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['user', 'tutor']).withMessage('Invalid role')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const users = await runQuery('SELECT id, name, email, COALESCE(plain_password, password) as password, role FROM users ORDER BY name');
    return res.render('admin/users', { error: errors.array()[0].msg, users });
  }
  
  const { name, email, password, role } = req.body;
  const id = uuidv4();
  const hashed = bcrypt.hashSync(password, 10);
  const userRole = (role === 'tutor') ? 'tutor' : 'user';
  dbRun('INSERT INTO users (id, name, email, password, plain_password, role) VALUES (?, ?, ?, ?, ?, ?)', [id, name, email, hashed, password, userRole], async (err) => {
    if (err) return res.redirect('/admin/users?error=Email already in use');
    
    // Send welcome email
    try {
      const templateName = userRole === 'tutor' ? 'welcomeTutor' : 'welcomeStudent';
      await sendEmail(email, templateName, {
        name,
        email,
        password,
        loginUrl: `${req.protocol}://${req.get('host')}/login`
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't block user creation if email fails
    }
    
    res.redirect('/admin/users?message=User created successfully. Credentials: ' + email + ' / ' + password);
  });
});

app.post('/admin/users/delete', requireAdmin, (req, res) => {
  const { userId } = req.body;
  dbRun('DELETE FROM users WHERE id = ?', [userId], (err) => {
    if (err) return res.redirect('/admin/users?error=Failed to delete user');
    res.redirect('/admin/users?message=User deleted successfully');
  });
});

app.post('/admin/users/reset-password', requireAdmin, (req, res) => {
  const { userId, newPassword } = req.body;
  if (!newPassword || newPassword.trim().length < 1) {
    return res.redirect('/admin/users?error=Password cannot be empty');
  }
  const hashed = bcrypt.hashSync(newPassword, 10);
  dbRun('UPDATE users SET password = ?, plain_password = ? WHERE id = ?', [hashed, newPassword, userId], (err) => {
    if (err) return res.redirect('/admin/users?error=Failed to reset password');
    res.redirect('/admin/users?message=Password reset successfully for user');
  });
});

// Admin media manager
app.get('/admin/media', requireAdmin, async (req, res) => {
  try {
    console.log('Loading media manager...');
    const files = await fs.promises.readdir(UPLOADS_DIR);
    console.log('Found files:', files);
    const fileUrls = files.filter(f => f !== '.gitkeep').map(f => `/uploads/${f}`);

    const mediaKeys = [
      'slide_1','slide_2','slide_3',
      'tutor_1_img','tutor_2_img','tutor_3_img','tutor_4_img','tutor_5_img','tutor_6_img'
    ];
    const placeholders = mediaKeys.map(()=>'?').join(',');
    const rows = mediaKeys.length ? await runQuery(`SELECT key, value FROM site_content WHERE key IN (${placeholders})`, mediaKeys) : [];
    const mediaValues = Object.fromEntries(mediaKeys.map(k => [k, '']));
    rows.forEach(r => { mediaValues[r.key] = r.value || ''; });

    const { message, error } = req.query;
    console.log('Rendering media with', fileUrls.length, 'files and message:', message);
    res.render('admin/media', { files: fileUrls, mediaValues, mediaKeys, message, error });
  } catch (err) {
    console.error('Admin media error:', err);
    res.status(500).render('admin/media', { files: [], mediaValues: {}, mediaKeys: [], error: 'Failed to load media manager', message: null });
  }
});

app.post('/admin/media/upload', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.redirect('/admin/media?error=No file selected');
    }
    console.log('File uploaded:', req.file.filename);
    // Reload page with success message
    return res.redirect('/admin/media?message=Image uploaded successfully: ' + encodeURIComponent(req.file.filename));
  } catch (err) {
    console.error('Upload error:', err);
    res.redirect('/admin/media?error=Upload failed');
  }
});

app.post('/admin/media/delete', requireAdmin, (req, res) => {
  const rel = req.body.path || '';
  const base = path.basename(rel.replace('/uploads/', ''));
  const target = path.join(UPLOADS_DIR, base);
  if (!target.startsWith(UPLOADS_DIR)) return res.status(400).send('Bad path');
  fs.unlink(target, (err) => {
    if (err) console.error('Delete media error', err);
    return res.redirect('/admin/media');
  });
});

// Admin: data exports (CSV/JSON)
app.get('/admin/export/:type', requireAdmin, async (req, res) => {
  try {
    const type = req.params.type;
    const fmt = (req.query.fmt||'csv').toLowerCase();
    let rows = [];
    switch(type){
      case 'users': rows = await runQuery('SELECT id, name, email, role, email_verified FROM users'); break;
      case 'products': rows = await runQuery('SELECT * FROM products'); break;
      case 'orders': rows = await runQuery('SELECT * FROM orders'); break;
      case 'messages': rows = await runQuery('SELECT * FROM messages'); break;
      case 'applications': rows = await runQuery('SELECT * FROM applications'); break;
      case 'lessons': rows = await runQuery('SELECT * FROM lessons'); break;
      case 'reports': rows = await runQuery('SELECT * FROM lesson_reports'); break;
      case 'recordings': rows = await runQuery('SELECT * FROM recordings'); break;
      case 'content': rows = await runQuery('SELECT * FROM site_content'); break;
      default: return res.status(400).send('Unknown export type');
    }
    if (fmt === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(rows));
    } else {
      const csv = toCSV(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
      res.send(csv);
    }
  } catch (e) {
    console.error('export error', e);
    res.status(500).send('Export failed');
  }
});

// Prepare Next and start server
// Start server when run directly; otherwise export `app` for tests
if (require.main === module) {
  nextApp.prepare().then(() => {
    // Fallback to Next for any routes not handled by Express (API/static)
    app.all('*', (req, res) => {
      return nextHandle(req, res);
    });

    if (USE_HTTPS) {
      const https = require('https');
      try {
        const key = fs.readFileSync(process.env.SSL_KEY);
        const cert = fs.readFileSync(process.env.SSL_CERT);
        https.createServer({ key, cert }, app).listen(PORT, () => console.log(`HTTPS server running on https://localhost:${PORT}`));
      } catch (e) {
        console.error('Failed to read SSL_KEY/SSL_CERT files, falling back to HTTP:', e);
        app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
      }
    } else {
      app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    }
  }).catch(err => {
    console.error('Error preparing Next:', err);
    process.exit(1);
  });
} else {
  // when required as a module (e.g., in tests), export the app
  module.exports = app;
}
