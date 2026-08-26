import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const db = require('../../../lib/db')
const multer = require('multer')

export const config = { api: { bodyParser: false } }

const uploadsDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${uuidv4()}-${path.basename(file.originalname)}`)
})
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|jpg|jpeg|png)$/i
    cb(null, allowed.test(path.extname(file.originalname)))
  }
})

let schemaReady
async function ensureSchema() {
  if (schemaReady) return schemaReady
  schemaReady = (async () => {
    await db.runExec(`CREATE TABLE IF NOT EXISTS wards (
      id TEXT PRIMARY KEY, parent_id TEXT NOT NULL, name TEXT NOT NULL, dob TEXT, school TEXT,
      level TEXT, subjects TEXT, notes TEXT, status TEXT DEFAULT 'active', created_at TEXT
    )`)
    await db.runExec(`CREATE TABLE IF NOT EXISTS enrollments (
      id TEXT PRIMARY KEY, ward_id TEXT NOT NULL, tutor_id TEXT, status TEXT DEFAULT 'pending',
      start_date TEXT, notes TEXT, created_at TEXT, updated_at TEXT
    )`)
    await db.runExec(`CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY, enrollment_id TEXT NOT NULL, tutor_id TEXT NOT NULL, title TEXT NOT NULL,
      instructions TEXT, due_date TEXT, file_path TEXT, total_points INTEGER DEFAULT 100,
      status TEXT DEFAULT 'published', created_at TEXT, updated_at TEXT
    )`)
    await db.runExec(`CREATE TABLE IF NOT EXISTS assignment_submissions (
      id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL, ward_id TEXT NOT NULL, file_path TEXT,
      answer_text TEXT, submitted_at TEXT, score REAL, feedback TEXT, graded_at TEXT,
      status TEXT DEFAULT 'submitted'
    )`)
    return true
  })()
  return schemaReady
}

function currentUser(req) {
  return (typeof req.getUser === 'function' && req.getUser()) || req.session?.user || null
}
function roleOf(req) {
  return (typeof req.getUserRole === 'function' && req.getUserRole()) || req.session?.user?.role || null
}
function forbidden(res) { return res.status(403).json({ error: 'forbidden' }) }
function auth(res, req) {
  const user = currentUser(req)
  if (!user) { res.status(401).json({ error: 'unauthenticated' }); return null }
  return user
}
function sameOrigin(req) {
  const origin = req.headers.origin
  if (!origin) return true
  return origin === `${req.protocol}://${req.get('host')}` || origin === `https://${req.get('host')}` || origin === `http://${req.get('host')}`
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => {
      try {
        const type = String(req.headers['content-type'] || '')
        if (type.includes('application/json')) return resolve(data ? JSON.parse(data) : {})
        const params = new URLSearchParams(data)
        const out = {}
        for (const [k, v] of params.entries()) out[k] = v
        resolve(out)
      } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

async function handler(req, res) {
  await ensureSchema()
  const user = auth(res, req)
  if (!user) return
  const role = roleOf(req)

  if (req.method === 'GET') {
    const action = req.query.action || 'overview'
    if (action === 'tutors') {
      if (!['admin', 'tutor', 'parent', 'user'].includes(role)) return forbidden(res)
      const tutors = await db.runQuery(`SELECT id,name,email FROM users WHERE role='tutor' ORDER BY name`)
      return res.json({ tutors })
    }
    if (action === 'overview') {
      const isAdmin = role === 'admin'
      const isTutor = role === 'tutor'
      const wards = isAdmin
        ? await db.runQuery(`SELECT w.*,u.name parent_name,u.email parent_email FROM wards w JOIN users u ON u.id=w.parent_id ORDER BY w.created_at DESC`)
        : isTutor
          ? await db.runQuery(`SELECT DISTINCT w.*,u.name parent_name FROM wards w JOIN enrollments e ON e.ward_id=w.id JOIN users u ON u.id=w.parent_id WHERE e.tutor_id=? ORDER BY w.name`, [user.id])
          : await db.runQuery(`SELECT * FROM wards WHERE parent_id=? ORDER BY created_at DESC`, [user.id])
      const enrollments = isAdmin
        ? await db.runQuery(`SELECT e.*,w.name ward_name,u.name tutor_name FROM enrollments e JOIN wards w ON w.id=e.ward_id LEFT JOIN users u ON u.id=e.tutor_id ORDER BY e.created_at DESC`)
        : isTutor
          ? await db.runQuery(`SELECT e.*,w.name ward_name,u.name tutor_name FROM enrollments e JOIN wards w ON w.id=e.ward_id LEFT JOIN users u ON u.id=e.tutor_id WHERE e.tutor_id=? ORDER BY e.created_at DESC`, [user.id])
          : await db.runQuery(`SELECT e.*,w.name ward_name,u.name tutor_name FROM enrollments e JOIN wards w ON w.id=e.ward_id LEFT JOIN users u ON u.id=e.tutor_id WHERE w.parent_id=? ORDER BY e.created_at DESC`, [user.id])
      const assignments = isAdmin
        ? await db.runQuery(`SELECT a.*,w.name ward_name,u.name tutor_name FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id JOIN wards w ON w.id=e.ward_id JOIN users u ON u.id=a.tutor_id ORDER BY a.created_at DESC`)
        : isTutor
          ? await db.runQuery(`SELECT a.*,w.name ward_name FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id JOIN wards w ON w.id=e.ward_id WHERE a.tutor_id=? ORDER BY a.created_at DESC`, [user.id])
          : await db.runQuery(`SELECT a.*,w.name ward_name,u.name tutor_name FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id JOIN wards w ON w.id=e.ward_id LEFT JOIN users u ON u.id=a.tutor_id WHERE w.parent_id=? ORDER BY a.created_at DESC`, [user.id])
      const submissions = isAdmin
        ? await db.runQuery(`SELECT s.*,a.title,w.name ward_name FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN wards w ON w.id=s.ward_id ORDER BY s.submitted_at DESC`)
        : isTutor
          ? await db.runQuery(`SELECT s.*,a.title,w.name ward_name FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN wards w ON w.id=s.ward_id WHERE a.tutor_id=? ORDER BY s.submitted_at DESC`, [user.id])
          : await db.runQuery(`SELECT s.*,a.title,w.name ward_name FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN wards w ON w.id=s.ward_id WHERE w.parent_id=? ORDER BY s.submitted_at DESC`, [user.id])
      const tutors = isAdmin ? await db.runQuery(`SELECT id,name,email FROM users WHERE role='tutor' ORDER BY name`) : []
      return res.json({ user: { id: user.id, name: user.name, role }, wards, enrollments, assignments, submissions, tutors })
    }
    return res.status(400).json({ error: 'unknown_action' })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (!sameOrigin(req)) return res.status(403).json({ error: 'origin_blocked' })

  const isMultipart = String(req.headers['content-type'] || '').includes('multipart/form-data')
  const finish = async (payload) => res.json(payload)
  const handle = async (body, file) => {
    const action = body.action

    if (action === 'create_ward') {
      if (role === 'admin') return forbidden(res)
      const name = String(body.name || '').trim()
      if (!name) return res.status(400).json({ error: 'Ward name is required' })
      const id = uuidv4(); const now = new Date().toISOString()
      await db.runExec(`INSERT INTO wards (id,parent_id,name,dob,school,level,subjects,notes,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`, [id,user.id,name,body.dob||null,body.school||null,body.level||null,body.subjects||null,body.notes||null,'active',now])
      const enrollmentId = uuidv4()
      await db.runExec(`INSERT INTO enrollments (id,ward_id,status,created_at,updated_at) VALUES (?,?,?,?,?)`, [enrollmentId,id,'pending',now,now])
      return finish({ success:true, wardId:id, enrollmentId })
    }

    if (action === 'assign_tutor') {
      if (role !== 'admin') return forbidden(res)
      const tutor = await db.runQueryOne(`SELECT id FROM users WHERE id=? AND role='tutor'`, [body.tutor_id])
      if (!tutor) return res.status(400).json({ error:'Tutor not found' })
      await db.runExec(`UPDATE enrollments SET tutor_id=?,status=?,start_date=COALESCE(start_date,?),updated_at=? WHERE id=?`, [body.tutor_id, body.status||'active', body.start_date||new Date().toISOString().slice(0,10), new Date().toISOString(), body.enrollment_id])
      return finish({success:true})
    }

    if (action === 'update_enrollment') {
      if (role !== 'admin') return forbidden(res)
      await db.runExec(`UPDATE enrollments SET status=?,notes=?,updated_at=? WHERE id=?`, [body.status||'active',body.notes||null,new Date().toISOString(),body.enrollment_id])
      return finish({success:true})
    }

    if (action === 'delete_ward') {
      if (role !== 'admin') return forbidden(res)
      await db.runExec(`DELETE FROM assignment_submissions WHERE ward_id=?`, [body.ward_id])
      await db.runExec(`DELETE FROM assignments WHERE enrollment_id IN (SELECT id FROM enrollments WHERE ward_id=?)`, [body.ward_id])
      await db.runExec(`DELETE FROM enrollments WHERE ward_id=?`, [body.ward_id])
      await db.runExec(`DELETE FROM wards WHERE id=?`, [body.ward_id])
      return finish({success:true})
    }

    if (action === 'create_assignment') {
      if (!['tutor','admin'].includes(role)) return forbidden(res)
      const enrollment = await db.runQueryOne(`SELECT e.*,w.name ward_name FROM enrollments e JOIN wards w ON w.id=e.ward_id WHERE e.id=?`, [body.enrollment_id])
      if (!enrollment) return res.status(404).json({error:'Enrollment not found'})
      if (role === 'tutor' && enrollment.tutor_id !== user.id) return forbidden(res)
      const title = String(body.title||'').trim(); if (!title) return res.status(400).json({error:'Title is required'})
      const id=uuidv4(), now=new Date().toISOString()
      const filePath=file ? file.filename : null
      await db.runExec(`INSERT INTO assignments (id,enrollment_id,tutor_id,title,instructions,due_date,file_path,total_points,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [id,body.enrollment_id,user.id,title,body.instructions||null,body.due_date||null,filePath,Number(body.total_points)||100,body.status||'published',now,now])
      return finish({success:true,id})
    }

    if (action === 'submit_assignment') {
      if (!['parent','user','admin'].includes(role)) return forbidden(res)
      const assignment = await db.runQueryOne(`SELECT a.*,w.id ward_id,w.parent_id FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id JOIN wards w ON w.id=e.ward_id WHERE a.id=?`, [body.assignment_id])
      if (!assignment) return res.status(404).json({error:'Assignment not found'})
      if (role !== 'admin' && assignment.parent_id !== user.id) return forbidden(res)
      const id=uuidv4(), now=new Date().toISOString()
      await db.runExec(`INSERT INTO assignment_submissions (id,assignment_id,ward_id,file_path,answer_text,submitted_at,status) VALUES (?,?,?,?,?,?,?)`, [id,assignment.id,assignment.ward_id,file?file.filename:null,body.answer_text||null,now,'submitted'])
      return finish({success:true,id})
    }

    if (action === 'grade_submission') {
      if (!['tutor','admin'].includes(role)) return forbidden(res)
      const sub = await db.runQueryOne(`SELECT s.*,a.tutor_id FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id WHERE s.id=?`, [body.submission_id])
      if (!sub) return res.status(404).json({error:'Submission not found'})
      if (role === 'tutor' && sub.tutor_id !== user.id) return forbidden(res)
      await db.runExec(`UPDATE assignment_submissions SET score=?,feedback=?,graded_at=?,status=? WHERE id=?`, [Number(body.score)||0,body.feedback||null,new Date().toISOString(),'graded',body.submission_id])
      return finish({success:true})
    }

    if (action === 'delete_assignment') {
      if (!['tutor','admin'].includes(role)) return forbidden(res)
      const a=await db.runQueryOne(`SELECT * FROM assignments WHERE id=?`,[body.assignment_id])
      if(!a) return res.status(404).json({error:'Assignment not found'})
      if(role==='tutor' && a.tutor_id!==user.id) return forbidden(res)
      await db.runExec(`DELETE FROM assignment_submissions WHERE assignment_id=?`,[a.id])
      await db.runExec(`DELETE FROM assignments WHERE id=?`,[a.id])
      return finish({success:true})
    }

    return res.status(400).json({error:'unknown_action'})
  }

  try {
    if (isMultipart) {
      upload.single('file')(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message || 'Upload failed' })
        try { return await handle(req.body || {}, req.file || null) } catch (e) { console.error('LMS multipart error',e); return res.status(500).json({error:'server'}) }
      })
    } else {
      const body = await readBody(req)
      return await handle(body, null)
    }
  } catch (e) {
    console.error('LMS API error', e)
    return res.status(500).json({ error:'server' })
  }
}

export default handler
