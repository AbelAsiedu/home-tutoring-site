import fs from 'fs'
import path from 'path'
const db = require('../../../lib/db')
const r2 = require('../../../lib/r2-storage')

export const config = { api: { bodyParser: false } }

function safeName(value) { return String(value || 'lms-file').replace(/[^a-z0-9._ -]/gi, '').trim().slice(0, 120) || 'lms-file' }

async function sendStored(res, filePath, name) {
  if (!filePath) return res.status(404).send('No file attached')
  if (String(filePath).startsWith('r2:')) {
    const key = String(filePath).slice(3)
    const object = await r2.getObject(key)
    const ext = path.extname(key) || '.bin'
    res.setHeader('Content-Type', object.ContentType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${safeName(name)}${ext}"`)
    if (object.ContentLength != null) res.setHeader('Content-Length', String(object.ContentLength))
    object.Body.pipe(res)
    return
  }
  const base = path.resolve(path.join(process.cwd(), 'uploads'))
  const full = path.resolve(path.join(base, path.basename(filePath)))
  if (!full.startsWith(base + path.sep) || !fs.existsSync(full)) return res.status(404).send('File not found')
  const ext = path.extname(full) || '.bin'
  return res.download(full, `${safeName(name)}${ext}`)
}

export default async function handler(req, res) {
  const user = (typeof req.getUser === 'function' && req.getUser()) || req.session?.user
  if (!user) return res.status(401).send('Unauthorized')
  const role = (typeof req.getUserRole === 'function' && req.getUserRole()) || req.session?.user?.role
  const id = String(req.query.id || '')
  const kind = String(req.query.kind || 'assignment')
  try {
    let row, filePath, name
    if (kind === 'assignment') {
      row = await db.runQueryOne(`SELECT a.*,e.tutor_id,w.parent_id,w.name ward_name FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id JOIN wards w ON w.id=e.ward_id WHERE a.id=?`, [id])
      if (!row) return res.status(404).send('Not found')
      if (role !== 'admin' && role !== 'tutor' && row.parent_id !== user.id && row.tutor_id !== user.id) return res.status(403).send('Forbidden')
      filePath = row.file_path; name = row.title || 'assignment'
    } else {
      row = await db.runQueryOne(`SELECT s.*,a.tutor_id,w.parent_id,a.title FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN wards w ON w.id=s.ward_id WHERE s.id=?`, [id])
      if (!row) return res.status(404).send('Not found')
      if (role !== 'admin' && role !== 'tutor' && row.parent_id !== user.id && row.tutor_id !== user.id) return res.status(403).send('Forbidden')
      filePath = row.file_path; name = `${row.title || 'submission'}-submission`
    }
    return await sendStored(res, filePath, name)
  } catch (e) {
    console.error('LMS download error', e)
    return res.status(500).send('Download failed')
  }
}
