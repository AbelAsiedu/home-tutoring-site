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
const sqlite3 = require('sqlite3').verbose();
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3001;

// Security / HTTPS helpers
const USE_HTTPS = !!(process.env.SSL_KEY && process.env.SSL_CERT);
const FORCE_HTTPS = process.env.FORCE_HTTPS === 'true';
const TRUST_PROXY = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
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
// Serve a built Next.js static export if present
const FRONTEND_OUT = path.join(__dirname, 'frontend-out');
if (fs.existsSync(FRONTEND_OUT)) {
  app.use(express.static(FRONTEND_OUT));
  app.get('*', (req, res, next) => {
    const indexPath = path.join(FRONTEND_OUT, 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    next();
  });
}

// Security: Helmet middleware for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdn.tiny.cloud", "https://js.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.tiny.cloud", "fonts.googleapis.com"],
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

// Optional: force HTTPS redirect when explicitly required
if (FORCE_HTTPS) {
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
  cookie: { maxAge: 1000 * 60 * 60 * 24, secure: !!(USE_HTTPS || process.env.NODE_ENV === 'production'), sameSite: 'lax' }
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
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    if (!verifyCsrfToken(req)) {
      console.warn(`[CSRF] Token mismatch for ${req.path}`);
      const view = req.path.includes('signup') ? 'signup' : (req.path.includes('admin') ? 'admin/login' : 'login');
      return res.status(403).render(view, { error: 'Security check failed. Please refresh and try again.', csrfToken: generateCsrfToken(req), isAdmin: false });
    }
  }
  next();
};

app.use(csrfProtection);

// Expose cart count and items to server-rendered views
app.use(async (req, res, next) => {
  try {
    const cart = req.session.cart || {};
    const ids = Object.keys(cart);
    let items = [];
    let count = 0;
    if (ids.length) {
      const rows = await runQuery(`SELECT * FROM products WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
      items = rows.map(r => ({ ...r, qty: cart[r.id] || 0 }));
      count = Object.values(cart).reduce((s,n) => s + (Number(n) || 0), 0);
    }
    res.locals.cartCount = count;
    res.locals.cartItems = items;
  } catch (e) {
    res.locals.cartCount = 0;
    res.locals.cartItems = [];
  }
  res.locals.isAdmin = req.session && req.session.user && req.session.user.role === 'admin';
  // Generate CSRF token for all views
  res.locals.csrfToken = generateCsrfToken(req);
  next();
});

// Friendly CSRF error handler
app.use((err, req, res, next) => {
  try {
    console.error('[Error]', err && err.stack ? err.stack : err);
    const view = req.path && req.path.includes('signup') ? 'signup' : (req.path && req.path.includes('admin') ? 'admin/login' : 'login');
    res.status(500).render(view, { error: 'An error occurred. Please refresh and try again.', csrfToken: generateCsrfToken(req), isAdmin: false }, (renderErr, html) => {
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

// Database
const DB_FILE = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(DB_FILE);

function initDb() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      plain_password TEXT,
      role TEXT DEFAULT 'user',
      email_verified INTEGER DEFAULT 0,
      verification_token TEXT,
      reset_token TEXT,
      reset_token_expiry INTEGER
    )`);
    
    // Migration: Add plain_password column if it doesn't exist
    db.run(`ALTER TABLE users ADD COLUMN plain_password TEXT`, (err) => {
      // Ignore error if column already exists
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error:', err);
      }
    });
    
    // Migration: Add email verification columns
    db.run(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error:', err);
      }
    });
    db.run(`ALTER TABLE users ADD COLUMN verification_token TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error:', err);
      }
    });
    db.run(`ALTER TABLE users ADD COLUMN reset_token TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error:', err);
      }
    });
    db.run(`ALTER TABLE users ADD COLUMN reset_token_expiry INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error:', err);
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      bio TEXT,
      subjects TEXT,
      cv_path TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      message TEXT,
      cv_path TEXT,
      created_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      price REAL,
      image_path TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      items TEXT,
      total REAL,
      payment_method TEXT,
      momo_number TEXT,
      card_last4 TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      subject TEXT,
      message TEXT,
      created_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS site_content (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);

    // Parental dashboard & lessons
    db.run(`CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      tutor_id TEXT,
      student_id TEXT,
      scheduled_at TEXT,
      duration_minutes INTEGER,
      status TEXT DEFAULT 'scheduled',
      recording_url TEXT,
      created_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS lesson_reports (
      id TEXT PRIMARY KEY,
      lesson_id TEXT,
      tutor_id TEXT,
      student_id TEXT,
      summary TEXT,
      homework TEXT,
      progress_score INTEGER,
      created_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      lesson_id TEXT,
      url TEXT,
      uploaded_at TEXT,
      notes TEXT
    )`);

    // Ensure admin user exists using environment variables for security
    const adminId = 'admin-1';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@modernpedagogues.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeThisPassword123!';
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    
    db.get('SELECT * FROM users WHERE id = ?', [adminId], (err, row) => {
      if (err) return console.error(err);
      if (!row) {
        const hashed = bcrypt.hashSync(adminPassword, 10);
        db.run('INSERT INTO users (id, name, email, password, plain_password, role) VALUES (?, ?, ?, ?, ?, ?)', [adminId, 'Admin', adminEmail, hashed, adminPassword, 'admin']);
        console.log(`Admin user created: username=${adminUsername} (check env vars for credentials)`);
      }
    });
  });
}

initDb();

// Seed sample data for manual testing (only if no lessons exist)
db.get('SELECT count(*) as c FROM lessons', (err, row) => {
  if (err) return console.error('Seed check error', err);
  if (row && row.c < 5) {
    console.log('Seeding sample users, lesson and report for manual testing...');
    const studentId = 'student-1';
    const tutorId = 'tutor-1';
    const hashed = bcrypt.hashSync('password', 10);
    db.run('INSERT OR IGNORE INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)', [studentId, 'Test Student', 'student@example.com', hashed, 'user']);
    db.run('INSERT OR IGNORE INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)', [tutorId, 'Test Tutor', 'tutor@example.com', hashed, 'tutor']);
    db.run('INSERT OR IGNORE INTO teachers (id, name, email, bio, subjects) VALUES (?, ?, ?, ?, ?)', [tutorId, 'Test Tutor', 'tutor@example.com', 'Experienced tutor', 'Math,Science']);
    const lessonId = uuidv4();
    const scheduled = new Date(Date.now() + 24*3600*1000).toISOString();
    db.run('INSERT INTO lessons (id, tutor_id, student_id, scheduled_at, duration_minutes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [lessonId, tutorId, studentId, scheduled, 30, 'scheduled', new Date().toISOString()]);
    const reportId = uuidv4();
    db.run('INSERT INTO lesson_reports (id, lesson_id, tutor_id, student_id, summary, homework, progress_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [reportId, lessonId, tutorId, studentId, 'Good progress on algebra', 'Complete worksheet 3', 7, new Date().toISOString()]);
  // Always ensure our demo titles point to the nicer SVGs (useful if demo items already exist)
  db.run("UPDATE products SET image_path = '/images/book-primary.svg' WHERE title = 'Primary Mathematics Workbook'");
  db.run("UPDATE products SET image_path = '/images/book-jhs-english.svg' WHERE title = 'JHS English Comprehension Pack'");
  db.run("UPDATE products SET image_path = '/images/book-shs-science.svg' WHERE title = 'SHS Science Revision Guide'");
  db.run("UPDATE products SET image_path = '/images/book-igcse-maths.svg' WHERE title = 'IGCSE Maths Problem Solving'");
  db.run("UPDATE products SET image_path = '/images/book-tutor-pack.svg' WHERE title = 'Tutor Resource Pack (Digital)'");
    const recId = uuidv4();
    const sampleUrl = null; // no file uploaded
    db.run('INSERT INTO recordings (id, lesson_id, url, uploaded_at, notes) VALUES (?, ?, ?, ?, ?)', [recId, lessonId, sampleUrl, new Date().toISOString(), 'Sample recording placeholder']);
  }
});

// Seed demo products if none exist
db.get('SELECT count(*) as c FROM products', (err, row) => {
  if (err) return console.error('Product seed check error', err);
  if (row && row.c < 5) {
    console.log('Seeding demo products for shop...');
    const demo = [
      { title: 'Primary Mathematics Workbook', description: 'Practice exercises aligned to the curriculum for Primary learners.', price: 30, image: '/images/book-primary.svg' },
      { title: 'JHS English Comprehension Pack', description: 'Reading passages and comprehension questions for JHS students.', price: 45, image: '/images/book-jhs-english.svg' },
      { title: 'SHS Science Revision Guide', description: 'Concise revision notes and past questions for SHS science subjects.', price: 60, image: '/images/book-shs-science.svg' },
      { title: 'IGCSE Maths Problem Solving', description: 'Targeted problem sets and mark schemes for IGCSE Maths.', price: 85, image: '/images/book-igcse-maths.svg' },
      { title: 'Tutor Resource Pack (Digital)', description: 'Editable worksheets, lesson plans and assessments (PDF bundle).', price: 20, image: '/images/book-tutor-pack.svg' }
    ];
    demo.forEach(p => {
      const id = uuidv4();
      db.run('INSERT INTO products (id, title, description, price, image_path) VALUES (?, ?, ?, ?, ?)', [id, p.title, p.description, p.price, p.image]);
    });
    // Ensure any earlier placeholder entries get updated to use our nicer SVGs
    db.run("UPDATE products SET image_path = '/images/book-primary.svg' WHERE title = 'Primary Mathematics Workbook'");
    db.run("UPDATE products SET image_path = '/images/book-jhs-english.svg' WHERE title = 'JHS English Comprehension Pack'");
    db.run("UPDATE products SET image_path = '/images/book-shs-science.svg' WHERE title = 'SHS Science Revision Guide'");
    db.run("UPDATE products SET image_path = '/images/book-igcse-maths.svg' WHERE title = 'IGCSE Maths Problem Solving'");
    db.run("UPDATE products SET image_path = '/images/book-tutor-pack.svg' WHERE title = 'Tutor Resource Pack (Digital)'");
  }
});

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

// Helper to run DB queries as promise
function runQuery(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
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
  const slides = await runQuery('SELECT key, value FROM site_content WHERE key LIKE "slide_%"');
  const products = await runQuery('SELECT * FROM products LIMIT 6');
  res.render('home', { slides, products });
});

app.get('/about', async (req, res) => {
  const about = await runQuery('SELECT value FROM site_content WHERE key = ?', ['about_text']);
  res.render('about', { about: about[0] ? about[0].value : null });
});

app.get('/contact', (req, res) => res.render('contact'));
app.post('/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  const id = uuidv4();
  const created = new Date().toISOString();
  db.run('INSERT INTO messages (id, name, email, subject, message, created_at) VALUES (?, ?, ?, ?, ?, ?)', [id, name, email, subject, message, created]);
  res.render('contact', { success: true });
});

app.get('/apply', (req, res) => res.render('apply'));
app.post('/apply', upload.single('cv'), (req, res) => {
  const { name, email, phone, message } = req.body;
  const cv_path = req.file ? `/uploads/${path.basename(req.file.path)}` : null;
  const id = uuidv4();
  const created = new Date().toISOString();
  db.run('INSERT INTO applications (id, name, email, phone, message, cv_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, name, email, phone, message, cv_path, created]);
  res.render('apply', { success: true });
});

app.get('/curriculum', async (req, res) => {
  // For demo, read curricula from site_content keys curriculum_*
  const curr = await runQuery('SELECT key, value FROM site_content WHERE key LIKE "curriculum_%"');
  const products = await runQuery('SELECT * FROM products');
  res.render('curriculum', { curr, products });
});

app.get('/tutors', (req, res) => {
  res.render('tutors');
});

app.get('/faq', (req, res) => {
  res.render('faq');
});

app.get('/privacy', (req, res) => res.render('privacy'));
app.get('/terms', (req, res) => res.render('terms'));

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
    const curr = await runQuery('SELECT key, value FROM site_content WHERE key LIKE "curriculum_%"');
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
  db.all(`SELECT * FROM products WHERE id IN (${ids.map(()=>'?').join(',')})`, ids, async (err, rows) => {
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
    db.run('INSERT INTO orders (id, user_id, items, total, payment_method, momo_number, card_last4, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, req.session.user ? req.session.user.id : null, JSON.stringify(items), total, payment_method, momo_number, card_last4, created]);
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
    db.run('INSERT INTO lessons (id, tutor_id, student_id, scheduled_at, duration_minutes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, tutor_id || null, student_id || (req.session.user ? req.session.user.id : null), scheduled_at || null, duration_minutes || 30, 'scheduled', created], (err) => {
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
    db.run('INSERT INTO lesson_reports (id, lesson_id, tutor_id, student_id, summary, homework, progress_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, lesson_id, tutor_id, lesson.student_id || null, summary || null, homework || null, progress_score || null, created], (err) => {
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
    db.run('INSERT INTO recordings (id, lesson_id, url, uploaded_at, notes) VALUES (?, ?, ?, ?, ?)', [id, lesson_id, url, uploaded_at, notes], (err) => {
      if (err) return res.status(500).json({ error: 'db' });
      // also attach to lesson record
      db.run('UPDATE lessons SET recording_url = ? WHERE id = ?', [url, lesson_id]);
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

// Serve Next.js static export if present
const frontOut = path.join(__dirname, 'frontend', 'out');
if (fs.existsSync(frontOut)) {
  app.use(express.static(frontOut));
  app.get('*', (req, res, next) => {
    const idx = path.join(frontOut, 'index.html');
    if (fs.existsSync(idx)) return res.sendFile(idx);
    next();
  });
}

// JSON API endpoints for frontend apps
app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products', (err, rows) => {
    if (err) return res.status(500).json({ error: 'db' });
    res.json(rows);
  });
});

app.get('/api/content/:key', (req, res) => {
  const key = req.params.key;
  db.get('SELECT value FROM site_content WHERE key = ?', [key], (err, row) => {
    if (err) return res.status(500).json({ error: 'db' });
    res.json({ key, value: row ? row.value : null });
  });
});

app.get('/api/curriculum', (req, res) => {
  db.all('SELECT key, value FROM site_content WHERE key LIKE "curriculum_%"', (err, rows) => {
    if (err) return res.status(500).json({ error: 'db' });
    res.json(rows);
  });
});

// NOTE: `/api/session` and `/api/cart/add` are defined earlier (for API clients).
// The earlier definitions return both `user` and `cart` and accept quantity.
// Keep those first definitions and do not redeclare them here to avoid
// inconsistent responses between server-rendered and Next.js frontends.

// Products API
app.post('/admin/products', upload.single('image'), (req, res) => {
  const { title, description, price } = req.body;
  const image_path = req.file ? `/uploads/${path.basename(req.file.path)}` : null;
  const id = uuidv4();
  db.run('INSERT INTO products (id, title, description, price, image_path) VALUES (?, ?, ?, ?, ?)', [id, title, description, price || 0, image_path]);
  res.redirect('/admin/products');
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
  db.all(`SELECT * FROM products WHERE id IN (${ids.map(()=>'?').join(',')})`, ids, async (err, rows) => {
    if (err) return res.status(500).send('DB error');
    let total = 0;
    const items = rows.map(r => {
      const qty = cart[r.id] || 0; total += r.price * qty; return { id: r.id, title: r.title, price: r.price, qty };
    });
    const id = uuidv4();
    const created = new Date().toISOString();
    const card_last4 = card_number ? card_number.slice(-4) : null;
    // If payment_method is 'card' and stripe available, create a Stripe Checkout session
    db.run('INSERT INTO orders (id, user_id, items, total, payment_method, momo_number, card_last4, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, req.session.user ? req.session.user.id : null, JSON.stringify(items), total, payment_method, momo_number, card_last4, created]);
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
  db.all('SELECT * FROM orders ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).send('DB error');
    res.render('admin/orders', { orders: rows });
  });
});

app.post('/admin/orders/:id/status', requireAdmin, (req, res) => {
  const id = req.params.id; const { status } = req.body;
  db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id], (err) => {
    if (err) return res.status(500).send('DB error');
    res.redirect('/admin/orders');
  });
});

// Auth: signup & login
app.get('/signup', (req, res) => res.render('signup'));
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
  
  db.run('INSERT INTO users (id, name, email, password, email_verified, verification_token) VALUES (?, ?, ?, ?, 0, ?)', 
    [id, name, email, hashed, verificationToken], async (err) => {
    if (err) return res.render('signup', { error: 'Email already in use' });
    
    // Send verification email
    try {
      const verificationUrl = `${req.protocol}://${req.get('host')}/verify/${verificationToken}`;
      await sendEmail(email, 'verification', {
        name,
        verificationUrl
      });
      req.session.user = { id, name, email, role: 'user', email_verified: false };
      res.redirect('/dashboard?message=Please check your email to verify your account');
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      req.session.user = { id, name, email, role: 'user', email_verified: false };
      res.redirect('/dashboard?error=Account created but failed to send verification email');
    }
  });
});

app.get('/login', (req, res) => res.render('login'));
app.post('/login', authLimiter, [
  body('email').trim().notEmpty().withMessage('Email or username is required'),
  body('password').notEmpty().withMessage('Password is required')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('login', { error: errors.array()[0].msg });
  }
  
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ? OR name = ?', [email, email], (err, user) => {
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
    if (user.role === 'admin') return res.redirect('/admin');
    if (user.role === 'tutor') return res.redirect('/tutor/lessons');
    res.redirect('/dashboard');
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

app.get('/admin/login', (req, res) => res.render('admin/login'));
app.post('/admin/login', adminLimiter, (req, res) => {
  const { username, password } = req.body;
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeThisPassword123!';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@modernpedagogues.com';
  
  if (username === adminUsername && password === adminPassword) {
    // fetch admin user row and set session
    db.get('SELECT * FROM users WHERE role = ?', ['admin'], (err, user) => {
      if (user) req.session.user = { id: user.id, name: user.name, email: user.email, role: 'admin' };
      else req.session.user = { id: 'admin-1', name: 'Admin', email: adminEmail, role: 'admin' };
      res.redirect('/admin');
    });
  } else res.render('admin/login', { error: 'Invalid admin credentials' });
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
  res.render('admin/products', { products });
});

// Admin: update product
app.post('/admin/products/:id/update', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { title, description, price, image_path } = req.body;
  db.run('UPDATE products SET title = ?, description = ?, price = ?, image_path = ? WHERE id = ?', [title, description, price || 0, image_path || null, id], (err)=>{
    if (err) return res.status(500).send('DB error');
    res.redirect('/admin/products');
  });
});

// Admin: delete product
app.post('/admin/products/:id/delete', requireAdmin, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM products WHERE id = ?', [id], (err)=>{
    if (err) return res.status(500).send('DB error');
    res.redirect('/admin/products');
  });
});

app.get('/admin/content', requireAdmin, async (req, res) => {
  const entries = await runQuery('SELECT key, value FROM site_content');
  res.render('admin/content', { entries: entries || [] });
});

app.post('/admin/content', requireAdmin, (req, res) => {
  const { key, value } = req.body;
  db.run('INSERT OR REPLACE INTO site_content (key, value) VALUES (?, ?)', [key, value]);
  res.redirect('/admin');
});

// Admin: delete a content entry
app.post('/admin/content/delete', requireAdmin, (req, res) => {
  const { key } = req.body;
  if (!key) return res.redirect('/admin/content');
  db.run('DELETE FROM site_content WHERE key = ?', [key], (err)=>{
    if (err) return res.status(500).send('DB error');
    res.redirect('/admin/content');
  });
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
  db.run('INSERT INTO users (id, name, email, password, plain_password, role) VALUES (?, ?, ?, ?, ?, ?)', [id, name, email, hashed, password, userRole], async (err) => {
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
  db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
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
  db.run('UPDATE users SET password = ?, plain_password = ? WHERE id = ?', [hashed, newPassword, userId], (err) => {
    if (err) return res.redirect('/admin/users?error=Failed to reset password');
    res.redirect('/admin/users?message=Password reset successfully for user');
  });
});

// Admin media manager
app.get('/admin/media', requireAdmin, (req, res) => {
  // list files in uploads
  fs.readdir(UPLOADS_DIR, (err, files) => {
    if (err) return res.status(500).send('FS error');
    const fileUrls = files.filter(f => f !== '.gitkeep').map(f => `/uploads/${f}`);
    res.render('admin/media', { files: fileUrls });
  });
});

app.post('/admin/media/upload', requireAdmin, upload.single('file'), (req, res) => {
  res.redirect('/admin/media');
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
