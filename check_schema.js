const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./data.db');

db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'", (err, rows) => {
  if (err) console.error('Error:', err);
  else console.log('Users table schema:\n', rows[0]?.sql || 'No table found');
  db.close();
});
