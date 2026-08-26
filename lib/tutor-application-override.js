// Restores the full tutor application workflow without requiring a fragile server.js merge.
// Loaded before server.js so it can replace the legacy /apply and admin application routes.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { runQuery, runQueryOne, runExec, getDb, getPool, getDbType } = require('./db');

const PRIVATE_DIR = path.join(__dirname, '..', 'private_uploads', 'tutor-applications');
fs.mkdirSync(PRIVATE_DIR, { recursive: true });

const allowedMime = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
const allowedExt = new Set(['.pdf', '.doc', '.docx']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PRIVATE_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  }
});
const tutorUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 30, parts: 35 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowedMime.has(file.mimetype) || !allowedExt.has(ext)) {
      return cb(new Error('CV must be a PDF, DOC, or DOCX file.'));
    }
    cb(null, true);
  }
});

function csrfToken(req) {
  if (!req.session.csrfSecret) req.session.csrfSecret = crypto.randomBytes(32).toString('hex');
  return crypto.createHmac('sha256', req.session.csrfSecret).update(req.sessionID).digest('hex');
}
function validCsrf(req) {
  const supplied = String((req.body && req.body._csrf) || req.headers['x-csrf-token'] || '');
  return !!supplied && !!req.session.csrfSecret && supplied === csrfToken(req);
}
function adminOnly(req, res, next) {
  const role = typeof req.getUserRole === 'function' ? req.getUserRole() : (req.session.user && req.session.user.role);
  if (role !== 'admin') return res.redirect('/admin/login');
  next();
}
function clean(value, max = 5000) {
  return String(value || '').trim().slice(0, max);
}
function removeUploaded(file) {
  if (file && file.path) fs.unlink(file.path, () => {});
}

async function migrate() {
  try {
    if (getDbType() === 'postgres') {
      const pool = getPool();
      if (!pool) return false;
      await pool.query(`CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, location TEXT,
        subjects TEXT, teaching_experience TEXT, qualifications TEXT, education TEXT,
        years_experience INTEGER, preferred_levels TEXT, availability TEXT,
        teaching_mode TEXT, message TEXT, cv_path TEXT, status TEXT DEFAULT 'pending',
        review_notes TEXT, reviewed_at TEXT, created_at TEXT
      )`);
      const cols = [
        ['location','TEXT'],['subjects','TEXT'],['teaching_experience','TEXT'],['qualifications','TEXT'],
        ['education','TEXT'],['years_experience','INTEGER'],['preferred_levels','TEXT'],['availability','TEXT'],
        ['teaching_mode','TEXT'],['status',"TEXT DEFAULT 'pending'"],['review_notes','TEXT'],['reviewed_at','TEXT']
      ];
      for (const [name, type] of cols) await pool.query(`ALTER TABLE applications ADD COLUMN IF NOT EXISTS ${name} ${type}`);
      return true;
    }
    const db = getDb();
    if (!db) return false;
    await new Promise((resolve, reject) => db.run(`CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, location TEXT,
      subjects TEXT, teaching_experience TEXT, qualifications TEXT, education TEXT,
      years_experience INTEGER, preferred_levels TEXT, availability TEXT,
      teaching_mode TEXT, message TEXT, cv_path TEXT, status TEXT DEFAULT 'pending',
      review_notes TEXT, reviewed_at TEXT, created_at TEXT
    )`, err => err ? reject(err) : resolve()));
    const cols = [
      ['location','TEXT'],['subjects','TEXT'],['teaching_experience','TEXT'],['qualifications','TEXT'],
      ['education','TEXT'],['years_experience','INTEGER'],['preferred_levels','TEXT'],['availability','TEXT'],
      ['teaching_mode','TEXT'],['status','TEXT DEFAULT \'pending\''],['review_notes','TEXT'],['reviewed_at','TEXT']
    ];
    for (const [name, type] of cols) await new Promise(resolve => db.run(`ALTER TABLE applications ADD COLUMN ${name} ${type}`, () => resolve()));
    return true;
  } catch (err) {
    console.error('[Tutor applications] migration retry:', err.message);
    return false;
  }
}

// Database initialization is asynchronous in PostgreSQL. Retry briefly until it is ready.
(async function ensureSchema() {
  for (let i = 0; i < 40; i++) {
    if (await migrate()) return;
    await new Promise(r => setTimeout(r, 250));
  }
  console.error('[Tutor applications] schema migration did not complete during startup window');
})();

function installRouteOverride(method, route, handler) {
  const original = express.application[method];
  if (express.application[`__tutor_${method}_patched`]) return;
  express.application[`__tutor_${method}_patched`] = true;
  express.application[method] = function patchedRoute(pathname, ...handlers) {
    if (pathname === route) return original.call(this, pathname, handler);
    return original.call(this, pathname, ...handlers);
  };
}

const getOriginal = express.application.get;
if (!express.application.__tutor_get_patched) {
  express.application.__tutor_get_patched = true;
  express.application.get = function(pathname, ...handlers) {
    if (pathname === '/apply') {
      return getOriginal.call(this, pathname, async (req, res) => {
        res.render('apply', { success: req.query.success === '1', error: req.query.error || '' , csrfToken: csrfToken(req) });
      });
    }
    if (pathname === '/admin/applications') {
      return getOriginal.call(this, pathname, adminOnly, async (req, res) => {
        const status = clean(req.query.status, 30);
        const search = clean(req.query.search, 100);
        const params = [];
        const where = [];
        if (status && ['pending','under_review','approved','rejected'].includes(status)) { where.push('status = ?'); params.push(status); }
        if (search) { where.push('(LOWER(name) LIKE LOWER(?) OR LOWER(email) LIKE LOWER(?) OR LOWER(subjects) LIKE LOWER(?) OR LOWER(location) LIKE LOWER(?))'); const q = `%${search}%`; params.push(q,q,q,q); }
        const apps = await runQuery(`SELECT * FROM applications ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`, params);
        res.render('admin/applications', { apps, filters: { status, search }, csrfToken: csrfToken(req) });
      });
    }
    if (pathname === '/admin/applications/:id') {
      return getOriginal.call(this, pathname, adminOnly, async (req, res) => {
        const application = await runQueryOne('SELECT * FROM applications WHERE id = ?', [req.params.id]);
        if (!application) return res.status(404).send('Application not found');
        res.render('admin/application-detail', { application, csrfToken: csrfToken(req) });
      });
    }
    if (pathname === '/admin/applications/:id/cv') {
      return getOriginal.call(this, pathname, adminOnly, async (req, res) => {
        const application = await runQueryOne('SELECT * FROM applications WHERE id = ?', [req.params.id]);
        if (!application || !application.cv_path) return res.status(404).send('CV not found');
        const full = path.resolve(application.cv_path);
        if (!full.startsWith(path.resolve(PRIVATE_DIR) + path.sep) || !fs.existsSync(full)) return res.status(404).send('CV not found');
        res.download(full, path.basename(full));
      });
    }
    return getOriginal.call(this, pathname, ...handlers);
  };
}

const postOriginal = express.application.post;
if (!express.application.__tutor_post_patched) {
  express.application.__tutor_post_patched = true;
  express.application.post = function(pathname, ...handlers) {
    if (pathname === '/apply') {
      return postOriginal.call(this, pathname, tutorUpload.single('cv'), async (req, res) => {
        if (!validCsrf(req)) { removeUploaded(req.file); return res.status(403).render('apply', { error: 'Security check failed. Please refresh and try again.', csrfToken: csrfToken(req) }); }
        const required = ['name','email','phone','location','subjects','teaching_experience','qualifications','education','preferred_levels','availability','teaching_mode'];
        for (const field of required) if (!clean(req.body[field])) { removeUploaded(req.file); return res.status(400).render('apply', { error: `${field.replace(/_/g, ' ')} is required.`, csrfToken: csrfToken(req) }); }
        if (!req.file) return res.status(400).render('apply', { error: 'A CV is required.', csrfToken: csrfToken(req) });
        const years = Number.parseInt(req.body.years_experience, 10);
        if (!Number.isInteger(years) || years < 0 || years > 60) { removeUploaded(req.file); return res.status(400).render('apply', { error: 'Years of experience must be between 0 and 60.', csrfToken: csrfToken(req) }); }
        const id = uuidv4();
        await runExec(`INSERT INTO applications
          (id,name,email,phone,location,subjects,teaching_experience,qualifications,education,years_experience,preferred_levels,availability,teaching_mode,message,cv_path,status,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
          id, clean(req.body.name,150), clean(req.body.email,200), clean(req.body.phone,50), clean(req.body.location,200),
          clean(req.body.subjects,1000), clean(req.body.teaching_experience,5000), clean(req.body.qualifications,2000),
          clean(req.body.education,2000), years, clean(req.body.preferred_levels,500), clean(req.body.availability,1000),
          clean(req.body.teaching_mode,100), clean(req.body.message,5000), req.file.path, 'pending', new Date().toISOString()
        ]);
        res.redirect('/apply?success=1');
      });
    }
    if (pathname === '/admin/applications/:id/status') {
      return postOriginal.call(this, pathname, adminOnly, async (req, res) => {
        if (!validCsrf(req)) return res.status(403).send('Security check failed');
        const status = clean(req.body.status, 30);
        if (!['pending','under_review','approved','rejected'].includes(status)) return res.status(400).send('Invalid status');
        const notes = clean(req.body.review_notes, 5000);
        const now = new Date().toISOString();
        const appRow = await runQueryOne('SELECT * FROM applications WHERE id = ?', [req.params.id]);
        if (!appRow) return res.status(404).send('Application not found');
        await runExec('UPDATE applications SET status = ?, review_notes = ?, reviewed_at = ? WHERE id = ?', [status, notes, now, req.params.id]);
        if (status === 'approved') {
          const teacherId = uuidv4();
          const existing = await runQueryOne('SELECT id FROM teachers WHERE email = ?', [appRow.email]);
          if (existing) await runExec('UPDATE teachers SET name = ?, bio = ?, subjects = ?, cv_path = ? WHERE id = ?', [appRow.name, appRow.teaching_experience, appRow.subjects, appRow.cv_path, existing.id]);
          else await runExec('INSERT INTO teachers (id,name,email,bio,subjects,cv_path) VALUES (?,?,?,?,?,?)', [teacherId, appRow.name, appRow.email, appRow.teaching_experience, appRow.subjects, appRow.cv_path]);
        }
        res.redirect(`/admin/applications/${encodeURIComponent(req.params.id)}?message=${encodeURIComponent(`Application ${status}`)}`);
      });
    }
    return postOriginal.call(this, pathname, ...handlers);
  };
}

module.exports = { migrate };
