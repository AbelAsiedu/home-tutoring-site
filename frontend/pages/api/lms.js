import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sqlite3 from 'sqlite3'
import { v4 as uuidv4 } from 'uuid'

const db = require('../../../lib/db')
const r2 = require('../../../lib/r2-storage')
const multer = require('multer')
export const config = { api: { bodyParser: false } }

const uploadsDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
const storage = r2.configured() ? multer.memoryStorage() : multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${uuidv4()}-${path.basename(file.originalname)}`)
})
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|jpg|jpeg|png)$/i.test(path.extname(file.originalname)))
})

async function saveFile(file, prefix) {
  if (!file) return null
  return r2.configured() ? `r2:${await r2.putBuffer(file.buffer, file.originalname, file.mimetype, prefix)` : file.filename
}
async function removeFile(filePath) {
  if (!filePath) return
  if (String(filePath).startsWith('r2:')) return r2.deleteObject(String(filePath).slice(3))
  const name = path.basename(String(filePath)); if (name !== String(filePath)) return
  try { await fs.promises.unlink(path.join(uploadsDir, name)) } catch (_) {}
}

let schemaReady
async function ensureSchema() {
  if (schemaReady) return schemaReady
  schemaReady = (async () => {
    await db.runExec(`CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY,user_id TEXT,role TEXT,action TEXT NOT NULL,method TEXT,path TEXT,status_code INTEGER,ip TEXT,user_agent TEXT,tab_id TEXT,metadata TEXT,created_at TEXT)`)
    await db.runExec(`CREATE TABLE IF NOT EXISTS wards (id TEXT PRIMARY KEY,parent_id TEXT NOT NULL,student_id TEXT,name TEXT NOT NULL,dob TEXT,school TEXT,level TEXT,subjects TEXT,notes TEXT,status TEXT DEFAULT 'active',created_at TEXT)`)
    await db.runExec(`ALTER TABLE wards ADD COLUMN student_id TEXT`).catch(() => {})
    await db.runExec(`CREATE TABLE IF NOT EXISTS enrollments (id TEXT PRIMARY KEY,ward_id TEXT NOT NULL,tutor_id TEXT,status TEXT DEFAULT 'pending',start_date TEXT,notes TEXT,created_at TEXT,updated_at TEXT)`)
    await db.runExec(`CREATE TABLE IF NOT EXISTS assignments (id TEXT PRIMARY KEY,enrollment_id TEXT NOT NULL,tutor_id TEXT NOT NULL,title TEXT NOT NULL,instructions TEXT,due_date TEXT,file_path TEXT,total_points INTEGER DEFAULT 100,status TEXT DEFAULT 'published',created_at TEXT,updated_at TEXT)`)
    await db.runExec(`CREATE TABLE IF NOT EXISTS assignment_submissions (id TEXT PRIMARY KEY,assignment_id TEXT NOT NULL,ward_id TEXT NOT NULL,file_path TEXT,answer_text TEXT,submitted_at TEXT,score REAL,feedback TEXT,graded_at TEXT,status TEXT DEFAULT 'submitted')`)
  })()
  return schemaReady
}

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const i=x.indexOf('='); return i<0 ? [x,''] : [x.slice(0,i),decodeURIComponent(x.slice(i+1))]
  }))
}
function unsign(value) {
  if (!value || !value.startsWith('s:')) return null
  const raw=value.slice(2), i=raw.lastIndexOf('.')
  if(i<=0)return null
  const sid=raw.slice(0,i), sig=raw.slice(i+1)
  const expected=crypto.createHmac('sha256',process.env.SESSION_SECRET || 'very-secret-key').update(sid).digest('base64').replace(/=+$/,'')
  const a=Buffer.from(sig),b=Buffer.from(expected)
  return a.length===b.length && crypto.timingSafeEqual(a,b) ? sid : null
}
function sessionDbCandidates() {
  const root = process.cwd()
  return [process.env.SESSION_DB_PATH,path.join(root,'sessions.sqlite'),path.join(root,'..','sessions.sqlite'),path.join(root,'..','..','sessions.sqlite')].filter(Boolean)
}
async function expressSession(req) {
  const sid=unsign(cookies(req)['connect.sid']); if(!sid)return null
  const file=sessionDbCandidates().find(candidate=>fs.existsSync(candidate)); if(!file)return null
  return new Promise(resolve => {
    const sdb=new sqlite3.Database(file,sqlite3.OPEN_READONLY,err=>{if(err)return resolve(null)})
    sdb.get('SELECT sess FROM sessions WHERE sid=?',[sid],(err,row)=>{sdb.close();if(err||!row)return resolve(null);try{resolve(JSON.parse(row.sess))}catch(_){resolve(null)}})
  })
}
async function getUser(req) {
  if (typeof req.getUser === 'function' && req.getUser()) return req.getUser()
  if (req.session?.user) return req.session.user
  const s=await expressSession(req); return s?.user || null
}
async function getRole(req,user) { return user?.role || req.session?.user?.role || (await expressSession(req))?.user?.role || null }
function deny(res){return res.status(403).json({error:'forbidden'})}
function parseBody(req){return new Promise((resolve,reject)=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>{try{const t=String(req.headers['content-type']||'');if(t.includes('application/json'))return resolve(d?JSON.parse(d):{});const o={};for(const [k,v] of new URLSearchParams(d))o[k]=v;resolve(o)}catch(e){reject(e)}});req.on('error',reject)})}

async function overview(user,role) {
  const admin=role==='admin', tutor=role==='tutor'||role==='teacher', student=role==='student'
  const wards=admin?await db.runQuery(`SELECT w.*,u.name parent_name,u.email parent_email FROM wards w JOIN users u ON u.id=w.parent_id ORDER BY w.created_at DESC`):tutor?await db.runQuery(`SELECT DISTINCT w.*,u.name parent_name FROM wards w JOIN enrollments e ON e.ward_id=w.id JOIN users u ON u.id=w.parent_id WHERE e.tutor_id=? ORDER BY w.name`,[user.id]):student?await db.runQuery(`SELECT * FROM wards WHERE student_id=? ORDER BY created_at DESC`,[user.id]):await db.runQuery(`SELECT * FROM wards WHERE parent_id=? ORDER BY created_at DESC`,[user.id])
  const enrollments=admin?await db.runQuery(`SELECT e.*,w.name ward_name,u.name tutor_name FROM enrollments e JOIN wards w ON w.id=e.ward_id LEFT JOIN users u ON u.id=e.tutor_id ORDER BY e.created_at DESC`):tutor?await db.runQuery(`SELECT e.*,w.name ward_name,u.name tutor_name FROM enrollments e JOIN wards w ON w.id=e.ward_id LEFT JOIN users u ON u.id=e.tutor_id WHERE e.tutor_id=? ORDER BY e.created_at DESC`,[user.id]):student?await db.runQuery(`SELECT e.*,w.name ward_name,u.name tutor_name FROM enrollments e JOIN wards w ON w.id=e.ward_id LEFT JOIN users u ON u.id=e.tutor_id WHERE w.student_id=? ORDER BY e.created_at DESC`,[user.id]):await db.runQuery(`SELECT e.*,w.name ward_name,u.name tutor_name FROM enrollments e JOIN wards w ON w.id=e.ward_id LEFT JOIN users u ON u.id=e.tutor_id WHERE w.parent_id=? ORDER BY e.created_at DESC`,[user.id])
  const assignments=admin?await db.runQuery(`SELECT a.*,w.name ward_name,u.name tutor_name FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id JOIN wards w ON w.id=e.ward_id JOIN users u ON u.id=a.tutor_id ORDER BY a.created_at DESC`):tutor?await db.runQuery(`SELECT a.*,w.name ward_name FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id JOIN wards w ON w.id=e.ward_id WHERE a.tutor_id=? ORDER BY a.created_at DESC`,[user.id]):student?await db.runQuery(`SELECT a.*,w.name ward_name,u.name tutor_name FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id JOIN wards w ON w.id=e.ward_id LEFT JOIN users u ON u.id=a.tutor_id WHERE w.student_id=? ORDER BY a.created_at DESC`,[user.id]):await db.runQuery(`SELECT a.*,w.name ward_name,u.name tutor_name FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id JOIN wards w ON w.id=e.ward_id LEFT JOIN users u ON u.id=a.tutor_id WHERE w.parent_id=? ORDER BY a.created_at DESC`,[user.id])
  const submissions=admin?await db.runQuery(`SELECT s.*,a.title,w.name ward_name FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN wards w ON w.id=s.ward_id ORDER BY s.submitted_at DESC`):tutor?await db.runQuery(`SELECT s.*,a.title,w.name ward_name FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN wards w ON w.id=s.ward_id WHERE a.tutor_id=? ORDER BY s.submitted_at DESC`,[user.id]):student?await db.runQuery(`SELECT s.*,a.title,w.name ward_name FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN wards w ON w.id=s.ward_id WHERE w.student_id=? ORDER BY s.submitted_at DESC`,[user.id]):await db.runQuery(`SELECT s.*,a.title,w.name ward_name FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN wards w ON w.id=s.ward_id WHERE w.parent_id=? ORDER BY s.submitted_at DESC`,[user.id])
  const tutors=admin?await db.runQuery(`SELECT id,name,email FROM users WHERE role IN ('tutor','teacher') ORDER BY name`):[]
  return {user:{id:user.id,name:user.name,role},wards,enrollments,assignments,submissions,tutors}
}

async function handler(req,res){
  try{
    await ensureSchema()
    const user=await getUser(req), role=await getRole(req,user)
    if(!user||!role)return res.status(401).json({error:'unauthenticated',message:'Please sign in before opening the learning portal.'})
    if(req.method==='GET'){
      if((req.query.action||'overview')==='tutors'){
        if(!['admin','tutor','teacher','parent','student'].includes(role))return deny(res)
        return res.json({tutors:await db.runQuery(`SELECT id,name,email FROM users WHERE role IN ('tutor','teacher') ORDER BY name`)})
      }
      if((req.query.action||'overview')==='overview')return res.json(await overview(user,role))
      return res.status(400).json({error:'unknown_action'})
    }
    if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'})
    const multipart=String(req.headers['content-type']||'').includes('multipart/form-data')
    const finish=x=>res.json(x)
    const act=async(body,file)=>{
      const a=body.action, now=new Date().toISOString()
      if(a==='create_ward'){
        if(role!=='parent')return deny(res);const name=String(body.name||'').trim();if(!name)return res.status(400).json({error:'Ward name is required'})
        const id=uuidv4();await db.runExec(`INSERT INTO wards(id,parent_id,name,dob,school,level,subjects,notes,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,[id,user.id,name,body.dob||null,body.school||null,body.level||null,body.subjects||null,body.notes||null,'active',now]);const eid=uuidv4();await db.runExec(`INSERT INTO enrollments(id,ward_id,status,created_at,updated_at) VALUES(?,?,?,?,?)`,[eid,id,'pending',now,now]);return finish({success:true,wardId:id,enrollmentId:eid})
      }
      if(a==='assign_tutor'){if(role!=='admin')return deny(res);const t=await db.runQueryOne(`SELECT id FROM users WHERE id=? AND role IN ('tutor','teacher')`,[body.tutor_id]);if(!t)return res.status(400).json({error:'Tutor not found'});await db.runExec(`UPDATE enrollments SET tutor_id=?,status=?,start_date=COALESCE(start_date,?),updated_at=? WHERE id=?`,[body.tutor_id,body.status||'active',body.start_date||now.slice(0,10),now,body.enrollment_id]);return finish({success:true})}
      if(a==='update_enrollment'){if(role!=='admin')return deny(res);await db.runExec(`UPDATE enrollments SET status=?,notes=?,updated_at=? WHERE id=?`,[body.status||'active',body.notes||null,now,body.enrollment_id]);return finish({success:true})}
      if(a==='delete_ward'){if(role!=='admin')return deny(res);const files=await db.runQuery(`SELECT file_path FROM assignment_submissions WHERE ward_id=? AND file_path IS NOT NULL UNION ALL SELECT a.file_path FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id WHERE e.ward_id=? AND a.file_path IS NOT NULL`,[body.ward_id,body.ward_id]);for(const f of files)await removeFile(f.file_path);await db.runExec(`DELETE FROM assignment_submissions WHERE ward_id=?`,[body.ward_id]);await db.runExec(`DELETE FROM assignments WHERE enrollment_id IN (SELECT id FROM enrollments WHERE ward_id=?)`,[body.ward_id]);await db.runExec(`DELETE FROM enrollments WHERE ward_id=?`,[body.ward_id]);await db.runExec(`DELETE FROM wards WHERE id=?`,[body.ward_id]);return finish({success:true})}
      if(a==='create_assignment'){if(!['tutor','teacher','admin'].includes(role))return deny(res);const e=await db.runQueryOne(`SELECT * FROM enrollments WHERE id=?`,[body.enrollment_id]);if(!e)return res.status(404).json({error:'Enrollment not found'});if((role==='tutor'||role==='teacher')&&e.tutor_id!==user.id)return deny(res);const title=String(body.title||'').trim();if(!title)return res.status(400).json({error:'Title is required'});const id=uuidv4(),fp=await saveFile(file,'assignments'),tid=role==='admin'?(e.tutor_id||user.id):user.id;await db.runExec(`INSERT INTO assignments(id,enrollment_id,tutor_id,title,instructions,due_date,file_path,total_points,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,[id,e.id,tid,title,body.instructions||null,body.due_date||null,fp,Number(body.total_points)||100,body.status||'published',now,now]);return finish({success:true,id})}
      if(a==='submit_assignment'){if(!['parent','student'].includes(role))return deny(res);const x=await db.runQueryOne(`SELECT a.*,w.id ward_id,w.parent_id,w.student_id FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id JOIN wards w ON w.id=e.ward_id WHERE a.id=?`,[body.assignment_id]);if(!x)return res.status(404).json({error:'Assignment not found'});if((role==='student'?x.student_id:x.parent_id)!==user.id)return deny(res);const id=uuidv4(),fp=await saveFile(file,'submissions');await db.runExec(`INSERT INTO assignment_submissions(id,assignment_id,ward_id,file_path,answer_text,submitted_at,status) VALUES(?,?,?,?,?,?,?)`,[id,x.id,x.ward_id,fp,body.answer_text||null,now,'submitted']);return finish({success:true,id})}
      if(a==='grade_submission'){if(!['tutor','teacher','admin'].includes(role))return deny(res);const s=await db.runQueryOne(`SELECT s.*,a.tutor_id FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id WHERE s.id=?`,[body.submission_id]);if(!s)return res.status(404).json({error:'Submission not found'});if((role==='tutor'||role==='teacher')&&s.tutor_id!==user.id)return deny(res);const score=Number(body.score);if(!Number.isFinite(score)||score<0)return res.status(400).json({error:'Invalid score'});await db.runExec(`UPDATE assignment_submissions SET score=?,feedback=?,graded_at=?,status=? WHERE id=?`,[score,body.feedback||null,now,'graded',s.id]);return finish({success:true})}
      if(a==='delete_assignment'){if(!['tutor','teacher','admin'].includes(role))return deny(res);const x=await db.runQueryOne(`SELECT * FROM assignments WHERE id=?`,[body.assignment_id]);if(!x)return res.status(404).json({error:'Assignment not found'});if((role==='tutor'||role==='teacher')&&x.tutor_id!==user.id)return deny(res);const fs2=await db.runQuery(`SELECT file_path FROM assignment_submissions WHERE assignment_id=? AND file_path IS NOT NULL`,[x.id]);for(const f of fs2)await removeFile(f.file_path);await removeFile(x.file_path);await db.runExec(`DELETE FROM assignment_submissions WHERE assignment_id=?`,[x.id]);await db.runExec(`DELETE FROM assignments WHERE id=?`,[x.id]);return finish({success:true})}
      return res.status(400).json({error:'unknown_action'})
    }
    if(multipart)return upload.single('file')(req,res,async err=>{if(err)return res.status(400).json({error:err.message||'Upload failed'});try{return await act(req.body||{},req.file||null)}catch(e){console.error('[LMS multipart]',e);return res.status(500).json({error:'server'})}})
    return await act(await parseBody(req),null)
  }catch(e){console.error('[LMS API]',e);return res.status(500).json({error:'server',message:e.message})}
}
export default handler
