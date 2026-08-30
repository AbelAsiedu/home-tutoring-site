import fs from 'fs'
import path from 'path'
import { getExpressUser } from '../../lib/express-session-user'
const db=require('../../../lib/db')
const r2=require('../../../lib/r2-storage')

export const config={api:{bodyParser:false}}
const clean=v=>String(v||'lms-file').replace(/[^a-z0-9._ -]/gi,'').trim().slice(0,120)||'lms-file'

async function sendFile(res,filePath,name){
 if(!filePath)return res.status(404).send('No file attached')
 if(String(filePath).startsWith('r2:')){
  const object=await r2.getObject(String(filePath).slice(3));const ext=path.extname(String(filePath))||'.bin'
  res.setHeader('Content-Type',object.ContentType||'application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename="${clean(name)}${ext}"`)
  if(object.ContentLength!=null)res.setHeader('Content-Length',String(object.ContentLength));return object.Body.pipe(res)
 }
 const base=path.resolve(path.join(process.cwd(),'uploads'));const filename=path.basename(String(filePath));const full=path.resolve(path.join(base,filename))
 if(filename!==String(filePath)||!full.startsWith(base+path.sep)||!fs.existsSync(full))return res.status(404).send('File not found')
 return res.download(full,`${clean(name)}${path.extname(full)||'.bin'}`)
}

export default async function handler(req,res){
 const user=await getExpressUser(req);if(!user)return res.status(401).json({error:'unauthenticated'})
 const id=String(req.query.id||''),kind=String(req.query.kind||'assignment'),role=String(user.role||'')
 if(!id||!['assignment','submission'].includes(kind))return res.status(400).json({error:'invalid_request'})
 try{
  let row
  if(kind==='assignment')row=await db.runQueryOne(`SELECT a.*,e.tutor_id,w.parent_id,w.student_id FROM assignments a JOIN enrollments e ON e.id=a.enrollment_id JOIN wards w ON w.id=e.ward_id WHERE a.id=?`,[id])
  else row=await db.runQueryOne(`SELECT s.*,a.tutor_id,a.title,w.parent_id,w.student_id FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN wards w ON w.id=s.ward_id WHERE s.id=?`,[id])
  if(!row)return res.status(404).json({error:'not_found'})
  const allowed=role==='admin'||role==='tutor'||role==='teacher'||row.tutor_id===user.id||row.parent_id===user.id||row.student_id===user.id
  if(!allowed)return res.status(403).json({error:'forbidden'})
  return sendFile(res,row.file_path,kind==='assignment'?row.title:`${row.title||'submission'}-submission`)
 }catch(e){console.error('[lms-file]',e);return res.status(500).json({error:'download_failed'})}
}
