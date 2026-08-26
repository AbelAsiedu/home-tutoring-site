import fs from 'fs'
import path from 'path'
const db = require('../../../lib/db')

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  const user = (typeof req.getUser === 'function' && req.getUser()) || req.session?.user
  if (!user) return res.status(401).send('Unauthorized')
  const role = (typeof req.getUserRole === 'function' && req.getUserRole()) || req.session?.user?.role
  const id = String(req.query.id || '')
  const kind = String(req.query.kind || 'assignment')
  try {
    let filePath = null
    let name = 'lms-file'
    if (kind === 'assignment') {
      const row = await db.runQueryOne(`SELECT a.*,e.tutor_id,w.parent_id,w.name ward_name FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id JOIN wards w ON w.id=e.ward_id WHERE a.id=?`, [id])
      if (!row) return res.status(404).send('Not found')
      if (role !== 'admin' && role !== 'tutor' && row.parent_id !== user.id && row.tutor_id !== user.id) return res.status(403).send('Forbidden')
      filePath = row.file_path; name = row.title || name
    } else {
      const row = await db.runQueryOne(`SELECT s.*,a.tutor_id,w.parent_id,a.title FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN wards w ON w.id=s.ward_id WHERE s.id=?`, [id])
      if (!row) return res.status(404).send('Not found')
      if (role !== 'admin' && role !== 'tutor' && row.parent_id !== user.id && row.tutor_id !== user.id) return res.status(403).send('Forbidden')
      filePath = row.file_path; name = `${row.title || 'submission'}-submission`
    }
    if (!filePath) return res.status(404).send('No file attached')
    const full = path.resolve(path.join(process.cwd(), 'uploads', path.basename(filePath)))
    const root = path.resolve(path.join(process.cwd(), 'uploads'))
    if (!full.startsWith(root + path.sep) || !fs.existsSync(full)) return res.status(404).send('File not found')
    const ext = path.extname(full) || '.bin'
    const safeName = name.replace(/[^a-z0-9._ -]/gi, '').trim().slice(0, 120) || 'lms-file'
    res.download(full, `${safeName}${ext}`)
  } catch (e) {
    console.error('LMS download error', e)
    res.status(500).send('Download failed')
  }
}
