import fs from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'
import signature from 'cookie-signature'

function cookies(header) {
  return Object.fromEntries(String(header || '').split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf('=')
    return i < 0 ? [x, ''] : [x.slice(0, i), decodeURIComponent(x.slice(i + 1))]
  }))
}

function sessionId(req) {
  const raw = cookies(req.headers?.cookie)['connect.sid']
  if (!raw) return null
  const value = decodeURIComponent(raw)
  if (value.startsWith('s:')) {
    // Use the same cookie-signature implementation as express-session.
    const unsigned = signature.unsign(value.slice(2), process.env.SESSION_SECRET || 'very-secret-key')
    return unsigned || null
  }
  // Development/legacy sessions may have an unsigned cookie.
  return value || null
}

function sessionDbCandidates() {
  const root = process.cwd()
  const configured = process.env.SESSION_DB_PATH
    ? path.resolve(root, process.env.SESSION_DB_PATH)
    : null
  return [
    configured,
    path.resolve(root, 'sessions.sqlite'),
    path.resolve(root, '..', 'sessions.sqlite'),
    path.resolve(root, '..', '..', 'sessions.sqlite')
  ].filter(Boolean)
}

export async function getExpressSession(req) {
  // When Next is being served by the same Express process, the session
  // middleware has already populated req.session. Prefer that authoritative
  // object before falling back to reading connect-sqlite3 directly.
  if (req.session?.user) return req.session

  const sid = sessionId(req)
  if (!sid) return null

  const file = sessionDbCandidates().find(candidate => fs.existsSync(candidate))
  if (!file) return null

  return new Promise(resolve => {
    const sdb = new sqlite3.Database(file, sqlite3.OPEN_READONLY, err => {
      if (err) return resolve(null)
    })
    sdb.get('SELECT sess FROM sessions WHERE sid=?', [sid], (err, row) => {
      sdb.close()
      if (err || !row) return resolve(null)
      try { resolve(JSON.parse(row.sess)) } catch (_) { resolve(null) }
    })
  })
}

export async function getExpressUser(req) {
  if (req.session?.user) return req.session.user
  return (await getExpressSession(req))?.user || null
}
