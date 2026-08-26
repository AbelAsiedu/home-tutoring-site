'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const pg = require('pg');

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET must be configured in production.');

try {
  const bp = require('body-parser');
  const origJson = bp.json, origUrl = bp.urlencoded;
  bp.json = (opts = {}) => origJson({ limit: opts.limit || '1mb', ...opts });
  bp.urlencoded = (opts = {}) => origUrl({ limit: opts.limit || '100kb', ...opts });
} catch (_) {}

try {
  const cors = require('cors'), origCors = cors;
  const wrappedCors = (options = {}) => {
    if (options && options.origin === true) {
      const configured = String(process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
      return origCors({ ...options, origin: (origin, cb) => !origin ? cb(null, true) : cb(null, configured.includes(origin)) });
    }
    return origCors(options);
  };
  Object.assign(wrappedCors, cors);
  require.cache[require.resolve('cors')].exports = wrappedCors;
} catch (_) {}

try {
  const multer = require('multer'), origMulter = multer;
  const safeExt = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|jpg|jpeg|png|webp|mp4|webm)$/i;
  const safeMime = new Set([
    'application/pdf','application/msword','application/vnd.ms-powerpoint','application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain',
    'image/jpeg','image/png','image/webp','video/mp4','video/webm'
  ]);
  const wrapped = (options = {}) => {
    const originalFilter = options.fileFilter;
    return origMulter({
      ...options,
      limits: { fileSize: 15 * 1024 * 1024, files: 10, fields: 50, ...options.limits },
      fileFilter: (req, file, cb) => {
        const ok = safeExt.test(path.extname(file.originalname || '')) && safeMime.has(String(file.mimetype || '').toLowerCase());
        if (!ok) return cb(new Error('Unsupported or unsafe file type.'));
        return originalFilter ? originalFilter(req, file, cb) : cb(null, true);
      }
    });
  };
  Object.assign(wrapped, multer);
  require.cache[require.resolve('multer')].exports = wrapped;
} catch (_) {}

// Shared PostgreSQL sessions for production/multi-instance traffic; SQLite remains the local fallback.
if (process.env.DATABASE_URL) {
  try {
    const { Pool } = pg;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.SESSION_DB_POOL_MAX || 20), idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000, ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false } });
    let ready;
    const ensure = () => ready || (ready = pool.query(`CREATE TABLE IF NOT EXISTS user_sessions (sid TEXT PRIMARY KEY, sess JSONB NOT NULL, expire TIMESTAMPTZ NOT NULL)`));
    class PgStore extends session.Store {
      async get(sid, cb) { try { await ensure(); const r = await pool.query('SELECT sess FROM user_sessions WHERE sid=$1 AND expire > NOW()', [sid]); cb(null, r.rows[0] ? r.rows[0].sess : null); } catch (e) { cb(e); } }
      async set(sid, sess, cb) { try { await ensure(); const expire = new Date(Date.now() + Number(sess.cookie?.maxAge || 86400000)); await pool.query(`INSERT INTO user_sessions(sid,sess,expire) VALUES($1,$2,$3) ON CONFLICT(sid) DO UPDATE SET sess=EXCLUDED.sess,expire=EXCLUDED.expire`, [sid, sess, expire]); cb && cb(null); } catch (e) { cb && cb(e); } }
      async destroy(sid, cb) { try { await ensure(); await pool.query('DELETE FROM user_sessions WHERE sid=$1', [sid]); cb && cb(null); } catch (e) { cb && cb(e); } }
      async touch(sid, sess, cb) { try { await ensure(); const expire = new Date(Date.now() + Number(sess.cookie?.maxAge || 86400000)); await pool.query('UPDATE user_sessions SET expire=$2 WHERE sid=$1', [sid, expire]); cb && cb(null); } catch (e) { cb && cb(e); } }
      async clear(cb) { try { await ensure(); await pool.query('DELETE FROM user_sessions'); cb && cb(null); } catch (e) { cb && cb(e); } }
    }
    require('connect-sqlite3');
    require.cache[require.resolve('connect-sqlite3')].exports = () => PgStore;
  } catch (e) { console.error('[security-hardening] PostgreSQL session store unavailable:', e.message); }
}

// Keep downloads byte-correct: repair legacy .zip names and legacy /public/uploads paths.
try {
  const originalDownload = express.response.download;
  express.response.download = function(filePath, filename, options, callback) {
    let resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    if (!require('fs').existsSync(resolvedPath)) {
      const legacyPrefix = path.join(process.cwd(), 'public', 'uploads') + path.sep;
      if (resolvedPath.startsWith(legacyPrefix)) resolvedPath = path.join(process.cwd(), 'uploads', path.basename(resolvedPath));
    }
    let safeName = filename;
    if (safeName && /\.zip$/i.test(safeName)) safeName = safeName.replace(/\.zip$/i, path.extname(resolvedPath) || '.bin');
    return originalDownload.call(this, resolvedPath, safeName, options, callback);
  };
} catch (_) {}

// Only image assets remain public under /uploads; course files, CVs and LMS documents are private.
const originalUse = express.application.use;
express.application.use = function(...args) {
  if (args[0] === '/uploads' && typeof args[1] === 'function') {
    const uploadDir = path.join(process.cwd(), 'uploads');
    const publicImage = (req, res, next) => {
      const filename = path.basename(req.path || '');
      if (!/\.(jpe?g|png|webp|gif)$/i.test(filename)) return res.status(404).send('Not found');
      const full = path.join(uploadDir, filename);
      if (!full.startsWith(uploadDir + path.sep)) return res.status(404).send('Not found');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');
      return res.sendFile(full, err => err && next(err));
    };
    return originalUse.call(this, '/uploads', publicImage);
  }
  return originalUse.apply(this, args);
};

let auditInstalled = false;
const installAudit = (app) => {
  if (auditInstalled) return;
  auditInstalled = true;
  const { runExec, runQuery, runQueryOne } = require('./db');
  runExec(`CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY,user_id TEXT,role TEXT,action TEXT NOT NULL,method TEXT,path TEXT,status_code INTEGER,ip TEXT,user_agent TEXT,tab_id TEXT,metadata TEXT,created_at TEXT)`).catch(e => console.error('[audit] schema:', e.message));

  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      const user = typeof req.getUser === 'function' ? req.getUser() : null;
      const important = req.method !== 'GET' || /\/download|\/marketplace|\/admin|\/lms|\/dashboard|\/profile|\/checkout|\/login|\/signup/.test(req.path);
      if (!important) return;
      runExec(`INSERT INTO audit_events(id,user_id,role,action,method,path,status_code,ip,user_agent,tab_id,metadata,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, [crypto.randomUUID(), user?.id || null, typeof req.getUserRole === 'function' ? req.getUserRole() : null, `${req.method} ${req.path}`, req.method, req.path, res.statusCode, req.ip || null, String(req.get('user-agent') || '').slice(0,500), req.tabId || null, JSON.stringify({ query: req.query, durationMs: Date.now() - started }), new Date().toISOString()]).catch(e => console.error('[audit] write:', e.message));
    });
    next();
  });

  // Secure LMS assignment/submission downloads used by the existing LMS UI.
  app.get('/api/lms-download', async (req, res) => {
    const user = typeof req.getUser === 'function' ? req.getUser() : null;
    const role = typeof req.getUserRole === 'function' ? req.getUserRole() : null;
    if (!user) return res.status(401).json({ error: 'unauthenticated' });
    const kind = String(req.query.kind || '');
    const id = String(req.query.id || '');
    if (!['assignment','submission'].includes(kind) || !id) return res.status(400).json({ error: 'invalid_request' });
    try {
      let file;
      if (kind === 'assignment') {
        file = await runQueryOne(`SELECT a.id,a.file_path,a.title,a.tutor_id,w.parent_id FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id JOIN wards w ON w.id=e.ward_id WHERE a.id=?`, [id]);
      } else {
        file = await runQueryOne(`SELECT s.id,s.file_path,a.title,a.tutor_id,w.parent_id FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN wards w ON w.id=s.ward_id WHERE s.id=?`, [id]);
      }
      if (!file || !file.file_path) return res.status(404).json({ error: 'file_not_found' });
      const allowed = role === 'admin' || (role === 'tutor' && file.tutor_id === user.id) || (['parent','user'].includes(role) && file.parent_id === user.id);
      if (!allowed) return res.status(403).json({ error: 'forbidden' });
      const filename = path.basename(file.file_path);
      if (filename !== file.file_path || !/\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|jpg|jpeg|png|webp|mp4|webm)$/i.test(filename)) return res.status(400).json({ error: 'unsafe_file' });
      const full = path.join(process.cwd(), 'uploads', filename);
      if (!full.startsWith(path.join(process.cwd(), 'uploads') + path.sep)) return res.status(403).json({ error: 'forbidden' });
      return res.download(full, `${String(file.title || kind).replace(/[^a-z0-9._ -]/gi,'_').slice(0,120)}${path.extname(filename)}`);
    } catch (e) {
      console.error('[lms-download]', e);
      return res.status(500).json({ error: 'download_failed' });
    }
  });

  app.get('/api/admin/activity', async (req, res) => {
    if (typeof req.getUserRole !== 'function' || req.getUserRole() !== 'admin') return res.status(403).json({ error: 'forbidden' });
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const rows = await runQuery(`SELECT a.*,u.name user_name,u.email user_email FROM audit_events a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT ?`, [limit]);
    res.json(rows);
  });

  app.get('/admin/activity', async (req, res) => {
    if (typeof req.getUserRole !== 'function' || req.getUserRole() !== 'admin') return res.redirect('/admin/login');
    const rows = await runQuery(`SELECT a.*,u.name user_name,u.email user_email FROM audit_events a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 250`, []);
    const users = await runQuery(`SELECT role, COUNT(*) count FROM users GROUP BY role`, []);
    const downloads = await runQuery(`SELECT COUNT(*) count FROM audit_events WHERE path LIKE '%/download%'`, []);
    const esc = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Activity Center</title><style>body{margin:0;background:#f5f7fb;color:#172033;font:14px Inter,system-ui,sans-serif}.wrap{max-width:1280px;margin:auto;padding:32px}.hero{background:linear-gradient(135deg,#111827,#243b64);color:#fff;border-radius:24px;padding:30px;box-shadow:0 18px 50px #11182725}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:20px 0}.card{background:#fff;border:1px solid #e5e9f0;border-radius:18px;padding:20px;box-shadow:0 8px 24px #1720330b}.num{font-size:30px;font-weight:800}.table{background:#fff;border-radius:18px;overflow:auto;border:1px solid #e5e9f0}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:13px;border-bottom:1px solid #edf0f5;white-space:nowrap}th{background:#f8fafc;position:sticky;top:0}.muted{color:#667085}@media(max-width:800px){.wrap{padding:16px}.grid{grid-template-columns:1fr}}</style></head><body><main class="wrap"><section class="hero"><h1>Admin Activity Center</h1><p>Audit trail for accounts, LMS actions, uploads, downloads, commerce and administration.</p></section><section class="grid"><div class="card"><div class="muted">Tracked events shown</div><div class="num">${rows.length}</div></div><div class="card"><div class="muted">Recorded downloads</div><div class="num">${Number(downloads[0]?.count || 0)}</div></div><div class="card"><div class="muted">Role groups</div><div class="num">${users.length}</div></div></section><section class="table"><table><thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Status</th><th>IP</th><th>Tab</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${new Date(r.created_at).toLocaleString()}</td><td>${esc(r.user_name || r.user_email || 'Visitor')}</td><td>${esc(r.role || 'visitor')}</td><td>${esc(r.action)}</td><td>${r.status_code}</td><td>${esc(r.ip || '')}</td><td>${esc(r.tab_id || '')}</td></tr>`).join('')}</tbody></table></section></main></body></html>`);
  });
};

const originalListen = express.application.listen;
express.application.listen = function(...args) { installAudit(this); return originalListen.apply(this, args); };
const useWithAudit = express.application.use;
express.application.use = function(...args) {
  const fn = args[args.length - 1];
  const source = typeof fn === 'function' ? Function.prototype.toString.call(fn) : '';
  const result = useWithAudit.apply(this, args);
  if (!auditInstalled && source.includes('req.getUser = function')) installAudit(this);
  return result;
};
