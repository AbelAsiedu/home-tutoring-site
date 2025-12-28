const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./db.sqlite');

db.all("SELECT key, value FROM site_content WHERE key LIKE 'slide_%'", (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Slides in database:', JSON.stringify(rows, null, 2));
  }
  db.close();
});
