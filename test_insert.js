const sqlite3 = require('sqlite3');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./data.db');

// Try inserting a test user
const id = uuidv4();
const testEmail = 'test-unique-' + Date.now() + '@test.com';
const hashed = bcrypt.hashSync('password123', 10);
const verificationToken = uuidv4();

console.log('Attempting insert with email:', testEmail);

db.run('INSERT INTO users (id, name, email, password, email_verified, verification_token) VALUES (?, ?, ?, ?, 0, ?)', 
  [id, 'Test User', testEmail, hashed, verificationToken], 
  function(err) {
    if (err) {
      console.log('Error occurred:');
      console.log('  Error message:', err.message);
      console.log('  Error code:', err.code);
      console.log('  Error toString:', err.toString());
    } else {
      console.log('Insert succeeded!');
    }
    db.close();
  });
