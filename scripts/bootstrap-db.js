#!/usr/bin/env node
'use strict';

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'data.db');
const db = new sqlite3.Database(dbPath);

const statements = [
  `CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    role TEXT,
    action TEXT NOT NULL,
    method TEXT,
    path TEXT,
    status_code INTEGER,
    ip TEXT,
    user_agent TEXT,
    tab_id TEXT,
    metadata TEXT,
    created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS wards (
    id TEXT PRIMARY KEY,
    parent_id TEXT NOT NULL,
    student_id TEXT,
    name TEXT NOT NULL,
    dob TEXT,
    school TEXT,
    level TEXT,
    subjects TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS enrollments (
    id TEXT PRIMARY KEY,
    ward_id TEXT NOT NULL,
    tutor_id TEXT,
    status TEXT DEFAULT 'pending',
    start_date TEXT,
    notes TEXT,
    created_at TEXT,
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    enrollment_id TEXT NOT NULL,
    tutor_id TEXT NOT NULL,
    title TEXT NOT NULL,
    instructions TEXT,
    due_date TEXT,
    file_path TEXT,
    total_points INTEGER DEFAULT 100,
    status TEXT DEFAULT 'published',
    created_at TEXT,
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS assignment_submissions (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL,
    ward_id TEXT NOT NULL,
    file_path TEXT,
    answer_text TEXT,
    submitted_at TEXT,
    score REAL,
    feedback TEXT,
    graded_at TEXT,
    status TEXT DEFAULT 'submitted'
  )`
];

function run(sql) {
  return new Promise((resolve, reject) => db.run(sql, err => err ? reject(err) : resolve()));
}

(async () => {
  try {
    for (const sql of statements) await run(sql);
    await run(`ALTER TABLE wards ADD COLUMN student_id TEXT`).catch(err => {
      if (!/duplicate column name/i.test(err.message)) throw err;
    });
    console.log('[bootstrap-db] LMS/audit schema ready:', dbPath);
  } catch (err) {
    console.error('[bootstrap-db] schema initialization failed:', err);
    process.exitCode = 1;
  } finally {
    db.close();
  }
})();
