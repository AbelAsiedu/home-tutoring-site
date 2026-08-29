import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sqlite3 from 'sqlite3'

function cookies(header) {
  return Object.fromEntries(String(header || '').split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf('=')
    return i < 0 ? [x, ''] : [x.slice(0, i), decodeURIComponent(x.slice(i + 1))]
  }))
}

function unsign(value) {
  if (!value || !value.startsWith('s:')) return null
  const raw = value.slice(2)
  const i = raw.lastIndexOf('.')
  if (i <= 0) return null
  const sid = raw.slice(0, i)
  const signature = raw.slice(i + 1)
  const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'very-secret-key').update(sid).digest('base64').replace(/=+$/, '')
  const a = Buffer.from(signature), b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? sid : null
}

export async function getExpressSession(req) {
  const sid = unsign(cookies(req.headers?.cookie)['connect.sid'])
  if (!sid) return null
  const file = path.join(process.cwd(), 'sessions.sqlite')
  if (!fs.existsSync(file)) return null
  return new Promise(resolve => {
    const sdb = new sqlite3.Database(file, sqlite3.OPEN_READONLY, err => { if (err) resolve(null) })
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
