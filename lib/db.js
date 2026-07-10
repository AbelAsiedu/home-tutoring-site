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
          google_id TEXT,
          google_profile_pic TEXT,
          profile_complete INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS user_profiles (
          id TEXT PRIMARY KEY,
          user_id TEXT UNIQUE,
          bio TEXT,
          avatar_path TEXT,
          phone TEXT,
          location TEXT,
          date_of_birth TEXT,
          occupation TEXT,
          interests TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (user_id) REFERENCES users(id)
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
        CREATE TABLE IF NOT EXISTS seller_applications (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          display_name TEXT,
          payout_email TEXT,
          motivation TEXT,
          sample_path TEXT,
          status TEXT DEFAULT 'pending',
          review_notes TEXT,
          created_at TEXT,
          updated_at TEXT
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          title TEXT,
          description TEXT,
          price REAL,
          image_path TEXT,
          file_path TEXT,
          is_downloadable BOOLEAN DEFAULT FALSE
        )
      `);

      await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS image_path TEXT');
      await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS file_path TEXT');
      await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS is_downloadable BOOLEAN DEFAULT FALSE');

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
        CREATE TABLE IF NOT EXISTS ai_chat_logs (
          id TEXT PRIMARY KEY,
          message TEXT,
          answer TEXT,
          intents TEXT,
          matched_topics TEXT,
          match_score REAL DEFAULT 0,
          fallback_used INTEGER DEFAULT 0,
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

      await client.query(`
        CREATE TABLE IF NOT EXISTS order_downloads (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          product_id TEXT,
          user_id TEXT,
          file_path TEXT,
          download_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP
        )
      `);

      // Marketplace tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS marketplace_content (
          id TEXT PRIMARY KEY,
          creator_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          category TEXT,
          file_path TEXT NOT NULL,
          thumbnail_path TEXT,
          file_size BIGINT,
          status TEXT DEFAULT 'draft',
          rating REAL DEFAULT 0,
          rating_count INTEGER DEFAULT 0,
          download_count INTEGER DEFAULT 0,
          visibility TEXT DEFAULT 'private',
          tags TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (creator_id) REFERENCES users(id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS marketplace_versions (
          id TEXT PRIMARY KEY,
          content_id TEXT NOT NULL,
          version_type TEXT DEFAULT 'free',
          file_path TEXT,
          file_size BIGINT,
          price REAL DEFAULT 0,
          license_type TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (content_id) REFERENCES marketplace_content(id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS marketplace_packs (
          id TEXT PRIMARY KEY,
          creator_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          price REAL NOT NULL,
          content_ids TEXT,
          thumbnail_path TEXT,
          status TEXT DEFAULT 'draft',
          created_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (creator_id) REFERENCES users(id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS marketplace_transactions (
          id TEXT PRIMARY KEY,
          buyer_id TEXT NOT NULL,
          seller_id TEXT NOT NULL,
          content_id TEXT,
          pack_id TEXT,
          transaction_type TEXT,
          amount REAL NOT NULL,
          payment_status TEXT DEFAULT 'pending',
          stripe_payment_id TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (buyer_id) REFERENCES users(id),
          FOREIGN KEY (seller_id) REFERENCES users(id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS marketplace_favorites (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          content_id TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (content_id) REFERENCES marketplace_content(id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS marketplace_reviews (
          id TEXT PRIMARY KEY,
          content_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          rating INTEGER,
          comment TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (content_id) REFERENCES marketplace_content(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS creator_earnings (
          id TEXT PRIMARY KEY,
          creator_id TEXT NOT NULL,
          month TEXT,
          total_earnings REAL DEFAULT 0,
          payout_status TEXT DEFAULT 'pending',
          payout_date TIMESTAMP,
          FOREIGN KEY (creator_id) REFERENCES users(id)
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
      reset_token_expiry INTEGER,
      google_id TEXT,
      google_profile_pic TEXT,
      profile_complete INTEGER DEFAULT 0
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE,
      bio TEXT,
      avatar_path TEXT,
      phone TEXT,
      location TEXT,
      date_of_birth TEXT,
      occupation TEXT,
      interests TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
    
    db.run(`ALTER TABLE users ADD COLUMN plain_password TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error:', err);
      }
    });

    db.run(`ALTER TABLE users ADD COLUMN google_id TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error:', err);
      }
    });

    db.run(`ALTER TABLE users ADD COLUMN google_profile_pic TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error:', err);
      }
    });

    db.run(`ALTER TABLE users ADD COLUMN profile_complete INTEGER DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error:', err);
      }
    });

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

    db.run(`CREATE TABLE IF NOT EXISTS seller_applications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      display_name TEXT,
      payout_email TEXT,
      motivation TEXT,
      sample_path TEXT,
      status TEXT DEFAULT 'pending',
      review_notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      price REAL,
      image_path TEXT,
      file_path TEXT,
      is_downloadable INTEGER DEFAULT 0
    )`);

    db.run('ALTER TABLE products ADD COLUMN image_path TEXT', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error:', err);
      }
    });
    db.run('ALTER TABLE products ADD COLUMN file_path TEXT', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error:', err);
      }
    });
    db.run('ALTER TABLE products ADD COLUMN is_downloadable INTEGER DEFAULT 0', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error:', err);
      }
    });

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

    db.run(`CREATE TABLE IF NOT EXISTS ai_chat_logs (
      id TEXT PRIMARY KEY,
      message TEXT,
      answer TEXT,
      intents TEXT,
      matched_topics TEXT,
      match_score REAL DEFAULT 0,
      fallback_used INTEGER DEFAULT 0,
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

    db.run(`CREATE TABLE IF NOT EXISTS order_downloads (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      product_id TEXT,
      user_id TEXT,
      file_path TEXT,
      download_count INTEGER DEFAULT 0,
      created_at TEXT,
      expires_at TEXT
    )`);

    // Marketplace tables for creator content & subscriptions
    db.run(`CREATE TABLE IF NOT EXISTS marketplace_content (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      file_size INTEGER,
      status TEXT DEFAULT 'draft',
      rating REAL DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      download_count INTEGER DEFAULT 0,
      visibility TEXT DEFAULT 'private',
      tags TEXT,
      created_at TEXT,
      updated_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS marketplace_versions (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL,
      version_type TEXT DEFAULT 'free',
      file_path TEXT,
      file_size INTEGER,
      price REAL DEFAULT 0,
      license_type TEXT,
      created_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS marketplace_packs (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      content_ids TEXT,
      thumbnail_path TEXT,
      status TEXT DEFAULT 'draft',
      created_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS marketplace_transactions (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      content_id TEXT,
      pack_id TEXT,
      transaction_type TEXT,
      amount REAL NOT NULL,
      payment_status TEXT DEFAULT 'pending',
      stripe_payment_id TEXT,
      created_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS marketplace_favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content_id TEXT,
      created_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS marketplace_reviews (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      rating INTEGER,
      comment TEXT,
      created_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS creator_earnings (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      month TEXT,
      total_earnings REAL DEFAULT 0,
      payout_status TEXT DEFAULT 'pending',
      payout_date TEXT
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
