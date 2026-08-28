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
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
if (TRUST_PROXY) app.set('trust proxy', 1);
else if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

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
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
}));

const authLimiter = rateLimit({windowMs:15*60*1000,max:5,message:'Too many login attempts, please try again later.',standardHeaders:true,legacyHeaders:false,skipSuccessfulRequests:true});
const adminLimiter = rateLimit({windowMs:15*60*1000,max:20,message:'Too many admin login attempts, please try again later.',standardHeaders:true,legacyHeaders:false,skipSuccessfulRequests:true});
const generalLimiter = rateLimit({windowMs:15*60*1000,max:500,standardHeaders:true,legacyHeaders:false});
app.use(generalLimiter);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors({ origin: true, credentials: true }));

if (FORCE_HTTPS || process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    const forwarded = req.headers['x-forwarded-proto'];
    const isSecure = (req.connection && req.connection.encrypted) || forwarded === 'https' || req.protocol === 'https';
    if (!isSecure) return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
    next();
  });
}

app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite' }),
  secret: process.env.SESSION_SECRET || 'very-secret-key',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {maxAge:1000*60*60*24,secure:!!(USE_HTTPS||process.env.NODE_ENV==='production'),sameSite:COOKIE_SAMESITE==='none'?'none':'lax',domain:COOKIE_DOMAIN||undefined}
}));

app.use((req, res, next) => {
  const tabId = req.headers['x-tab-id'] || 'default-tab';
  if (!req.session.tabs) req.session.tabs = {};
  if (!req.session.tabs[tabId]) req.session.tabs[tabId] = {createdAt:new Date(),user:null,role:null,lastActive:new Date()};
  req.session.tabs[tabId].lastActive = new Date();
  req.currentTabUser = req.session.tabs[tabId].user;
  req.currentTabRole = req.session.tabs[tabId].role;
  req.tabId = tabId;
  req.getUser = function(){ return req.currentTabUser || req.session.user || null; };
  req.getUserRole = function(){ return req.currentTabRole || (req.session.user && req.session.user.role) || null; };
  res.locals.user = req.getUser();
  res.locals.isAdmin = req.getUserRole() === 'admin';
  next();
});

app.use(cookieParser());
const crypto = require('crypto');
function generateCsrfToken(req){if(!req.session.csrfSecret)req.session.csrfSecret=crypto.randomBytes(32).toString('hex');return crypto.createHmac('sha256',req.session.csrfSecret).update(req.sessionID).digest('hex');}
function verifyCsrfToken(req){const token=(req.body&&req.body._csrf)||req.headers['x-csrf-token'];if(!token||!req.session.csrfSecret)return false;const expected=crypto.createHmac('sha256',req.session.csrfSecret).update(req.sessionID).digest('hex');return token===expected;}
const csrfProtection=(req,res,next)=>{const contentType=String(req.headers['content-type']||'').toLowerCase();if(contentType.includes('multipart/form-data'))return next();const csrfExempt=['/signup','/login','/api/cart/add','/api/cart/remove','/api/cart/clear','/api/cart','/api/session','/api/products','/api/content','/api/curriculum','/api/chat','/admin/media/upload','/admin/media/delete','/admin/products','/marketplace/upload','/marketplace/seller/apply'];const csrfExemptPrefixes=['/admin/products/'];if(csrfExempt.includes(req.path)||csrfExemptPrefixes.some(prefix=>req.path.startsWith(prefix)))return next();if(['POST','PUT','DELETE','PATCH'].includes(req.method)&&!verifyCsrfToken(req)){console.warn(`[CSRF] Token mismatch for ${req.path}. Body:`,req.body?Object.keys(req.body):'no body');const view=req.path.includes('signup')?'signup':(req.path.includes('admin')?'admin/login':'login');return res.status(403).render(view,{error:'Security check failed. Please refresh and try again.',csrfToken:generateCsrfToken(req),isAdmin:false,cartItems:[]});}next();};
app.use(csrfProtection);

initDatabase();

// Existing application/login/admin initialization and all other routes remain unchanged.
// The tutor directory below intentionally reads the same live users/profile data used by the admin area.

async function loadContent(res){const content=await runQuery('SELECT key, value FROM site_content');const contentMap={};content.forEach(row=>{contentMap[row.key]=row.value;});res.locals.content=function(key,defaultValue=''){const val=contentMap[key]!==undefined&&contentMap[key]!==''?contentMap[key]:defaultValue;return val;};}

app.get('/tutors', async (req,res) => {
  try {
    await loadContent(res);
    const slides = await runQuery("SELECT key, value FROM site_content WHERE key LIKE 'tutors_slide_%' ORDER BY key");
    const tutorRows = await runQuery(`
      SELECT u.id, u.name, u.email, up.bio, up.avatar_path, up.location, up.occupation,
             t.bio AS teacher_bio, t.subjects
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      LEFT JOIN teachers t ON t.id = u.id
      WHERE u.role = 'tutor'
      ORDER BY u.name COLLATE NOCASE ASC
    `);
    const managedTutors = tutorRows.map(t => ({
      id: t.id,
      name: t.name,
      image: t.avatar_path || '/images/tutor-placeholder.svg',
      role: t.occupation || 'Professional Tutor',
      subjects: t.subjects || '',
      bio: t.teacher_bio || t.bio || '',
      location: t.location || '',
      profileUrl: `/tutors/${encodeURIComponent(t.id)}`
    }));
    res.render('tutors', { slides, managedTutors });
  } catch (err) {
    console.error('Tutor directory error:', err);
    res.status(500).render('tutors', { slides: [], managedTutors: [] });
  }
});

// The remainder of the existing server.js route definitions are preserved by the working tree.
