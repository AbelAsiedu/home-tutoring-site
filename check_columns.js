const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./data.db');

db.all('PRAGMA table_info(users)', (err, rows) => {
  if (err) console.error('Error:', err);
  else {
    console.log('Users table columns:');
    rows.forEach(col => console.log('  -', col.name, '(' + col.type + ')'));
  }
  db.close();
});
