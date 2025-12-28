// Database adapter: uses Postgres if DATABASE_URL is set, otherwise SQLite
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

let dbType = 'sqlite';
let db = null;
let pool = null;

// Initialize database
function initDb() {
  if (process.env.DATABASE_URL) {
    // Use Postgres
    dbType = 'postgres';
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false } // required for Neon over SSL
    });
    
    pool.on('error', (err) => {
      console.error('Postgres pool error:', err);
    });
    
    console.log('Using PostgreSQL database');
    initPostgresSchema();
  } else {
    // Use SQLite
    dbType = 'sqlite';
    const DB_FILE = path.join(__dirname, '..', 'data.db');
    db = new sqlite3.Database(DB_FILE);
    console.log('Using SQLite database at', DB_FILE);
    initSqliteSchema();
  }
}

// Initialize Postgres schema
async function initPostgresSchema() {
  if (!pool) return;
  try {
    const client = await pool.connect();
    try {
      // Create tables if they don't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT UNIQUE,
          password TEXT,
          plain_password TEXT,
          role TEXT DEFAULT 'user',
          email_verified INTEGER DEFAULT 0,
          verification_token TEXT,
          reset_token TEXT,
          reset_token_expiry BIGINT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS teachers (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT,
          bio TEXT,
          subjects TEXT,
          cv_path TEXT
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS applications (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT,
          phone TEXT,
          message TEXT,
          cv_path TEXT,
          created_at TEXT
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          title TEXT,
          description TEXT,
          price REAL,
          image_path TEXT
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          items TEXT,
          total REAL,
          payment_method TEXT,
          momo_number TEXT,
          card_last4 TEXT,
          status TEXT DEFAULT 'pending',
          created_at TEXT
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT,
          subject TEXT,
          message TEXT,
          created_at TEXT
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS site_content (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS lessons (
          id TEXT PRIMARY KEY,
          tutor_id TEXT,
          student_id TEXT,
          scheduled_at TEXT,
          duration_minutes INTEGER,
          status TEXT DEFAULT 'scheduled',
          recording_url TEXT,
          created_at TEXT
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS lesson_reports (
          id TEXT PRIMARY KEY,
          lesson_id TEXT,
          tutor_id TEXT,
          student_id TEXT,
          summary TEXT,
          homework TEXT,
          progress_score INTEGER,
          created_at TEXT
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS recordings (
          id TEXT PRIMARY KEY,
          lesson_id TEXT,
          url TEXT,
          uploaded_at TEXT,
          notes TEXT
        )
      `);

      console.log('PostgreSQL schema initialized');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error initializing PostgreSQL schema:', err);
  }
}

// Initialize SQLite schema (existing code)
function initSqliteSchema() {
  if (!db) return;
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
    
    db.run(`ALTER TABLE users ADD COLUMN plain_password TEXT`, (err) => {
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
  });
}

// Query helpers
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (dbType === 'postgres') {
      // Convert SQLite placeholders (?) to Postgres placeholders ($1, $2, etc.)
      let pgSql = sql;
      let paramIndex = 1;
      pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
      
      pool.query(pgSql, params, (err, result) => {
        if (err) reject(err);
        else resolve(result.rows);
      });
    } else {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    }
  });
}

function runQueryOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (dbType === 'postgres') {
      let pgSql = sql;
      let paramIndex = 1;
      pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
      
      pool.query(pgSql, params, (err, result) => {
        if (err) reject(err);
        else resolve(result.rows[0] || null);
      });
    } else {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    }
  });
}

function runExec(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (dbType === 'postgres') {
      let pgSql = sql;
      let paramIndex = 1;
      pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
      
      pool.query(pgSql, params, (err, result) => {
        if (err) reject(err);
        else resolve({ changes: result.rowCount || 0 });
      });
    } else {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes || 0 });
      });
    }
  });
}

// For callback-based code (legacy)
function dbRun(sql, params, callback) {
  if (dbType === 'postgres') {
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
    
    pool.query(pgSql, params, (err) => {
      if (callback) callback(err);
    });
  } else {
    db.run(sql, params, callback);
  }
}

function dbGet(sql, params, callback) {
  if (dbType === 'postgres') {
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
    
    pool.query(pgSql, params, (err, result) => {
      if (callback) callback(err, result ? result.rows[0] : null);
    });
  } else {
    db.get(sql, params, callback);
  }
}

function dbAll(sql, params, callback) {
  if (dbType === 'postgres') {
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
    
    pool.query(pgSql, params, (err, result) => {
      if (callback) callback(err, result ? result.rows : []);
    });
  } else {
    db.all(sql, params, callback);
  }
}

// Prepare for bulk insert (used in admin)
function dbPrepare(sql) {
  if (dbType === 'postgres') {
    return {
      run: (params) => {
        let pgSql = sql;
        let paramIndex = 1;
        pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
        return new Promise((resolve, reject) => {
          pool.query(pgSql, params, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      },
      finalize: (callback) => {
        if (callback) callback(null);
      }
    };
  } else {
    const stmt = db.prepare(sql);
    return {
      run: (params=[]) => new Promise((resolve, reject) => {
        stmt.run(params, function(err){
          if (err) reject(err); else resolve();
        });
      }),
      finalize: (callback) => stmt.finalize(callback)
    };
  }
}

module.exports = {
  initDb,
  runQuery,
  runQueryOne,
  runExec,
  dbRun,
  dbGet,
  dbAll,
  dbPrepare,
  getDb: () => db,
  getPool: () => pool,
  getDbType: () => dbType
};
