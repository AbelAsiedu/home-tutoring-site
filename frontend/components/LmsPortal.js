import { useEffect, useMemo, useState } from 'react'
import Header from './Header'
import Footer from './Footer'

const card = {background:'linear-gradient(145deg,rgba(255,255,255,.92),rgba(245,247,255,.9))',border:'1px solid rgba(15,23,42,.08)',borderRadius:20,padding:20,boxShadow:'0 16px 45px rgba(15,23,42,.08)'}
const input = {width:'100%',padding:'11px 13px',borderRadius:12,border:'1px solid rgba(15,23,42,.15)',background:'#fff',fontSize:14}

async function apiGet(action='overview') { const r=await fetch(`/api/lms?action=${action}`,{credentials:'include'}); const j=await r.json(); if(!r.ok) throw new Error(j.error||'Unable to load LMS'); return j }
async function apiPost(form) { const r=await fetch('/api/lms',{method:'POST',credentials:'include',body:form}); const j=await r.json(); if(!r.ok) throw new Error(j.error||'Request failed'); return j }

export default function LmsPortal({ mode='portal' }) {
  const [data,setData]=useState(null), [error,setError]=useState(''), [notice,setNotice]=useState('')
  const [ward,setWard]=useState({name:'',dob:'',school:'',level:'',subjects:'',notes:''})
  const [assignment,setAssignment]=useState({enrollment_id:'',title:'',instructions:'',due_date:'',total_points:100,file:null})
  const [submission,setSubmission]=useState({assignment_id:'',answer_text:'',file:null})
  const [grade,setGrade]=useState({submission_id:'',score:'',feedback:''})
  const [filter,setFilter]=useState('all')

  const load=()=>apiGet().then(setData).catch(e=>setError(e.message))
  useEffect(()=>{load()},[])

  const stats=useMemo(()=>{
    if(!data) return []
    const graded=(data.submissions||[]).filter(s=>s.status==='graded')
    const avg=graded.length?Math.round(graded.reduce((a,s)=>a+Number(s.score||0),0)/graded.length):0
    return [
      ['Wards',data.wards?.length||0,'👨‍👩‍👧'],['Active enrollments',(data.enrollments||[]).filter(e=>e.status==='active').length,'🎓'],['Assignments',data.assignments?.length||0,'📝'],['Average score',`${avg}%`,'📈']
    ]
  },[data])

  async function submitForm(form, success){ try{setError('');setNotice('');await apiPost(form);setNotice(success);await load()}catch(e){setError(e.message)} }
  function enrollWard(e){e.preventDefault();const f=new FormData();f.append('action','create_ward');Object.entries(ward).forEach(([k,v])=>f.append(k,v));submitForm(f,'Ward enrolled successfully. An administrator can now assign a tutor.')}
  function createAssignment(e){e.preventDefault();const f=new FormData();f.append('action','create_assignment');Object.entries(assignment).forEach(([k,v])=>{if(v!==null&&v!==undefined)f.append(k,v)});submitForm(f,'Assignment published.')}
  function submitAssignment(e){e.preventDefault();const f=new FormData();f.append('action','submit_assignment');Object.entries(submission).forEach(([k,v])=>{if(v!==null&&v!==undefined)f.append(k,v)});submitForm(f,'Assignment submitted for marking.')}
  function gradeSubmission(e){e.preventDefault();const f=new FormData();f.append('action','grade_submission');Object.entries(grade).forEach(([k,v])=>f.append(k,v));submitForm(f,'Result posted to the learner portal.')}
  function assignTutor(id,tutor){const f=new FormData();f.append('action','assign_tutor');f.append('enrollment_id',id);f.append('tutor_id',tutor);f.append('status','active');submitForm(f,'Tutor assigned.')}
  function updateEnrollment(id,status){const f=new FormData();f.append('action','update_enrollment');f.append('enrollment_id',id);f.append('status',status);submitForm(f,'Enrollment status updated.')}
  function deleteWard(id){if(!confirm('Remove this ward and all associated LMS records?'))return;const f=new FormData();f.append('action','delete_ward');f.append('ward_id',id);submitForm(f,'Ward removed.')}

  if(!data) return <><Header/><main className="container" style={{padding:'50px 20px'}}><div style={card}>Loading learning portal…</div></main><Footer/></>

  const role=data.user.role
  const title=mode==='enroll'?'Enroll a Ward':role==='admin'?'LMS Administration':role==='tutor'?'Tutor Learning Workspace':'Parent Learning Portal'
  const visibleAssignments=(data.assignments||[]).filter(a=>filter==='all'||(filter==='pending'&&(!data.submissions||!data.submissions.some(s=>s.assignment_id===a.id)))||(filter==='graded'&&data.submissions?.some(s=>s.assignment_id===a.id&&s.status==='graded')))

  return <div style={{background:'linear-gradient(180deg,#f7f9fc 0%,#eef2ff 55%,#f8fafc 100%)',minHeight:'100vh'}}><Header/>
    <main className="container" style={{padding:'28px 20px 60px'}}>
      <section style={{...card,background:'linear-gradient(135deg,#111827,#243b64)',color:'#fff',padding:'30px',overflow:'hidden',position:'relative'}}>
        <div style={{position:'relative',zIndex:2}}><div style={{fontSize:12,letterSpacing:2,textTransform:'uppercase',opacity:.7}}>Modern Pedagogues • Learning Management System</div><h1 style={{margin:'8px 0',fontSize:'clamp(28px,5vw,44px)',color:'#fff'}}>{title}</h1><p style={{margin:0,maxWidth:700,opacity:.82}}>One secure workspace for ward enrollment, tutoring, assignments, submissions, marking, results and academic progress.</p></div>
      </section>

      {error&&<div style={{...card,marginTop:16,borderColor:'#fecaca',color:'#991b1b'}}>⚠ {error}</div>}
      {notice&&<div style={{...card,marginTop:16,borderColor:'#bbf7d0',color:'#166534'}}>✓ {notice}</div>}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:14,marginTop:18}}>{stats.map(([label,value,icon])=><div key={label} style={card}><div style={{fontSize:24}}>{icon}</div><div style={{fontSize:13,color:'#64748b',marginTop:8}}>{label}</div><div style={{fontSize:28,fontWeight:800,color:'#172554'}}>{value}</div></div>)}</div>

      {(mode==='enroll'||role==='parent'||role==='user')&&<section style={{...card,marginTop:20}}><div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><h2 style={{margin:'0 0 5px'}}>Enroll a ward</h2><p style={{margin:0,color:'#64748b'}}>Add your child/ward once, then let the admin assign the right tutor.</p></div></div><form onSubmit={enrollWard} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,marginTop:18}}>{[['name','Ward full name'],['dob','Date of birth'],['school','School'],['level','Class / level'],['subjects','Subjects']].map(([k,l])=><label key={k} style={{fontSize:13,fontWeight:700,color:'#334155'}}>{l}<input style={input} required={k==='name'} type={k==='dob'?'date':'text'} value={ward[k]} onChange={e=>setWard({...ward,[k]:e.target.value})}/></label>)}<label style={{gridColumn:'1/-1',fontSize:13,fontWeight:700,color:'#334155'}}>Learning notes<textarea style={{...input,minHeight:90}} value={ward.notes} onChange={e=>setWard({...ward,notes:e.target.value})}/></label><button className="btn" type="submit">Enroll Ward</button></form></section>}

      {(role==='admin'||role==='tutor')&&<section style={{...card,marginTop:20}}><h2 style={{marginTop:0}}>Create assignment</h2><form onSubmit={createAssignment} encType="multipart/form-data" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}><label style={{fontSize:13,fontWeight:700}}>Learner / enrollment<select style={input} required value={assignment.enrollment_id} onChange={e=>setAssignment({...assignment,enrollment_id:e.target.value})}><option value="">Select enrollment</option>{data.enrollments.filter(e=>role==='admin'||e.tutor_id===data.user.id).map(e=><option key={e.id} value={e.id}>{e.ward_name} — {e.tutor_name||'Unassigned'}</option>)}</select></label><label style={{fontSize:13,fontWeight:700}}>Title<input style={input} required value={assignment.title} onChange={e=>setAssignment({...assignment,title:e.target.value})}/></label><label style={{fontSize:13,fontWeight:700}}>Due date<input style={input} type="datetime-local" value={assignment.due_date} onChange={e=>setAssignment({...assignment,due_date:e.target.value})}/></label><label style={{fontSize:13,fontWeight:700}}>Total points<input style={input} type="number" min="1" value={assignment.total_points} onChange={e=>setAssignment({...assignment,total_points:e.target.value})}/></label><label style={{gridColumn:'1/-1',fontSize:13,fontWeight:700}}>Instructions<textarea style={{...input,minHeight:110}} value={assignment.instructions} onChange={e=>setAssignment({...assignment,instructions:e.target.value})}/></label><label style={{fontSize:13,fontWeight:700}}>Attachment<input style={input} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" onChange={e=>setAssignment({...assignment,file:e.target.files?.[0]||null})}/></label><div><button className="btn" type="submit" style={{marginTop:22}}>Publish Assignment</button></div></form></section>}

      {role==='admin'&&<section style={{...card,marginTop:20}}><h2 style={{marginTop:0}}>Administrator controls</h2><p style={{color:'#64748b'}}>Assign tutors, activate/suspend enrollments, remove wards and oversee every submission.</p><div style={{display:'grid',gap:10}}>{data.enrollments.map(e=><div key={e.id} style={{display:'grid',gridTemplateColumns:'1.2fr 1fr auto auto',gap:10,alignItems:'center',padding:12,border:'1px solid #e2e8f0',borderRadius:14}}><div><strong>{e.ward_name}</strong><div style={{fontSize:12,color:'#64748b'}}>Status: {e.status}</div></div><select style={input} defaultValue={e.tutor_id||''} onChange={x=>x.target.value&&assignTutor(e.id,x.target.value)}><option value="">Assign tutor…</option>{data.tutors.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><button className="btn ghost" onClick={()=>updateEnrollment(e.id,e.status==='active'?'suspended':'active')}>{e.status==='active'?'Suspend':'Activate'}</button><button className="btn ghost" onClick={()=>deleteWard(e.ward_id)}>Remove</button></div>)}</div></section>}

      {(role==='parent'||role==='user')&&<section style={{...card,marginTop:20}}><h2 style={{marginTop:0}}>My wards & tutor assignments</h2><div style={{display:'grid',gap:10}}>{data.enrollments.map(e=><div key={e.id} style={{padding:15,border:'1px solid #e2e8f0',borderRadius:14}}><strong>{e.ward_name}</strong><span style={{marginLeft:10,padding:'4px 8px',borderRadius:999,background:'#eef2ff',fontSize:12}}>{e.status}</span><div style={{color:'#64748b',marginTop:5}}>Tutor: {e.tutor_name||'Awaiting administrator assignment'}</div></div>)}</div></section>}

      <section style={{...card,marginTop:20}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}><h2 style={{margin:0}}>{role==='tutor'||role==='admin'?'Assignments & submissions':'Assignments'}</h2><select style={{...input,width:180}} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All assignments</option><option value="pending">Needs submission</option><option value="graded">Graded</option></select></div><div style={{display:'grid',gap:12,marginTop:15}}>{visibleAssignments.map(a=><div key={a.id} style={{border:'1px solid #e2e8f0',borderRadius:16,padding:16}}><div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><div><h3 style={{margin:'0 0 4px'}}>{a.title}</h3><div style={{fontSize:13,color:'#64748b'}}>{a.ward_name} • Due {a.due_date?new Date(a.due_date).toLocaleString():'No deadline'} • {a.total_points} points</div></div>{a.file_path&&<a className="btn ghost" href={`/api/lms-download?kind=assignment&id=${a.id}`}>Download brief</a>}</div>{a.instructions&&<p style={{whiteSpace:'pre-wrap',color:'#475569'}}>{a.instructions}</p>}
        {(role==='parent'||role==='user')&&<form onSubmit={submitAssignment} style={{display:'grid',gap:10,marginTop:12}}><input type="hidden" value={a.id}/><textarea style={{...input,minHeight:80}} placeholder="Optional answer / notes" value={submission.assignment_id===a.id?submission.answer_text:''} onChange={e=>setSubmission({...submission,assignment_id:a.id,answer_text:e.target.value})}/><input style={input} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" onChange={e=>setSubmission({...submission,assignment_id:a.id,file:e.target.files?.[0]||null})}/><button className="btn" type="submit">Submit for marking</button></form>}
        {role==='tutor'||role==='admin'?<div style={{marginTop:12,display:'grid',gap:8}}>{data.submissions.filter(s=>s.assignment_id===a.id).map(s=><div key={s.id} style={{background:'#f8fafc',padding:12,borderRadius:12}}><div><strong>{s.ward_name}</strong> <span style={{color:'#64748b'}}>• {s.status}</span></div>{s.answer_text&&<div style={{fontSize:13,marginTop:5}}>{s.answer_text}</div>}{s.file_path&&<a href={`/api/lms-download?kind=submission&id=${s.id}`}>View submission file</a>}{s.status==='graded'?<div style={{marginTop:5}}><strong>Result: {s.score}%</strong><div>{s.feedback}</div></div>:<form onSubmit={gradeSubmission} style={{display:'grid',gridTemplateColumns:'120px 1fr auto',gap:8,marginTop:8}}><input style={input} type="number" min="0" max="100" placeholder="Score %" onChange={e=>setGrade({...grade,submission_id:s.id,score:e.target.value})}/><input style={input} placeholder="Feedback" onChange={e=>setGrade({...grade,submission_id:s.id,feedback:e.target.value})}/><button className="btn" type="submit">Post result</button></form>}</div>)}</div>:null}</div>)}</div></section>
    </main><Footer/></div>
}
