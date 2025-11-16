const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const Stripe = require('stripe');
const stripe = process.env.STRIPE_SECRET ? Stripe(process.env.STRIPE_SECRET) : null;
const next = require(path.join(__dirname, 'frontend', 'node_modules', 'next'));
const nextApp = next({ dev: process.env.NODE_ENV !== 'production', dir: path.join(__dirname, 'frontend') });
const nextHandle = nextApp.getRequestHandler();
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3001;

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
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite' }),
  secret: process.env.SESSION_SECRET || 'very-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

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
  next();
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
      role TEXT DEFAULT 'user'
    )`);

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

    // Ensure admin user exists (username: admin, password: password) per spec
    const adminId = 'admin-1';
    db.get('SELECT * FROM users WHERE id = ?', [adminId], (err, row) => {
      if (err) return console.error(err);
      if (!row) {
        const hashed = bcrypt.hashSync('password', 10);
        db.run('INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)', [adminId, 'Admin', 'admin@local', hashed, 'admin']);
        console.log('Admin user created: username=admin password=password');
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
  const cart = req.session.cart || {};
  const ids = Object.keys(cart);
  if (!ids.length) return res.status(400).json({ error: 'empty_cart' });
  db.all(`SELECT * FROM products WHERE id IN (${ids.map(()=>'?').join(',')})`, ids, async (err, rows) => {
    if (err) return res.status(500).json({ error: 'db' });
    let total = 0;
    const items = rows.map(r => { const qty = cart[r.id] || 0; total += r.price * qty; return { id: r.id, title: r.title, price: r.price, qty }; });
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

app.get('/api/session', (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post('/api/cart/add', (req, res) => {
  const { id } = req.body;
  if (!req.session.cart) req.session.cart = {};
  req.session.cart[id] = (req.session.cart[id] || 0) + 1;
  res.json({ ok: true, cart: req.session.cart });
});

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
app.post('/signup', (req, res) => {
  const { name, email, password } = req.body;
  const id = uuidv4();
  const hashed = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)', [id, name, email, hashed], (err) => {
    if (err) return res.render('signup', { error: 'Email already in use' });
    req.session.user = { id, name, email };
    res.redirect('/account');
  });
});

app.get('/login', (req, res) => res.render('login'));
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ? OR name = ?', [email, email], (err, user) => {
    if (err || !user) return res.render('login', { error: 'Invalid credentials' });
    if (!bcrypt.compareSync(password, user.password)) return res.render('login', { error: 'Invalid credentials' });
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    if (user.role === 'admin') return res.redirect('/admin');
    res.redirect('/account');
  });
});

app.get('/logout', (req, res) => { req.session.destroy(()=>res.redirect('/')); });

app.get('/account', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('account');
});

// Admin routes
function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  // allow login using username admin and password password (per spec) as form fields
  res.redirect('/admin/login');
}

app.get('/admin/login', (req, res) => res.render('admin/login'));
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'password') {
    // fetch admin user row and set session
    db.get('SELECT * FROM users WHERE role = ?', ['admin'], (err, user) => {
      if (user) req.session.user = { id: user.id, name: user.name, email: user.email, role: 'admin' };
      else req.session.user = { id: 'admin-1', name: 'Admin', email: 'admin@local', role: 'admin' };
      res.redirect('/admin');
    });
  } else res.render('admin/login', { error: 'Invalid admin credentials' });
});

app.get('/admin', requireAdmin, async (req, res) => {
  const users = await runQuery('SELECT count(*) as c FROM users');
  const products = await runQuery('SELECT count(*) as c FROM products');
  const orders = await runQuery('SELECT count(*) as c FROM orders');
  const messages = await runQuery('SELECT count(*) as c FROM messages');
  res.render('admin/dashboard', { stats: { users: users[0].c, products: products[0].c, orders: orders[0].c, messages: messages[0].c } });
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

app.post('/admin/content', requireAdmin, (req, res) => {
  const { key, value } = req.body;
  db.run('INSERT OR REPLACE INTO site_content (key, value) VALUES (?, ?)', [key, value]);
  res.redirect('/admin');
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

// Prepare Next and start server
// Start server when run directly; otherwise export `app` for tests
if (require.main === module) {
  nextApp.prepare().then(() => {
    // Fallback to Next for any routes not handled by Express (API/static)
    app.all('*', (req, res) => {
      return nextHandle(req, res);
    });

    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  }).catch(err => {
    console.error('Error preparing Next:', err);
    process.exit(1);
  });
} else {
  // when required as a module (e.g., in tests), export the app
  module.exports = app;
}
