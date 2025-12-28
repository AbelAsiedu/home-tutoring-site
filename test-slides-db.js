require('dotenv').config();
const { Pool } = require('pg');
const sqlite3 = require('sqlite3');

// Mirror the server.js database logic
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;
const db = !pool ? new sqlite3.Database('./db.sqlite') : null;

async function runQuery(sql, params = []) {
  if (pool) {
    try {
      const result = await pool.query(sql.replace(/\?/g, (_, i) => `$${params.indexOf(_) + 1}`), params);
      return result.rows;
    } catch (error) {
      console.error('Postgres query error:', error);
      throw error;
    }
  } else {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

(async () => {
  try {
    console.log('Using:', pool ? 'Postgres' : 'SQLite');
    const slides = await runQuery("SELECT key, value FROM site_content WHERE key LIKE 'slide_%'");
    console.log('Slides found:', JSON.stringify(slides, null, 2));
    
    if (pool) await pool.end();
    if (db) db.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
