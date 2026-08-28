import { useEffect, useMemo, useState } from 'react'
import Header from './Header'
import Footer from './Footer'

const card={background:'rgba(255,255,255,.94)',border:'1px solid #e2e8f0',borderRadius:22,padding:20,boxShadow:'0 16px 45px rgba(15,23,42,.07)'}
const input={width:'100%',padding:'12px 13px',borderRadius:12,border:'1px solid #cbd5e1',background:'#fff',fontSize:14,boxSizing:'border-box'}
const button={border:0,borderRadius:12,padding:'11px 16px',fontWeight:800,cursor:'pointer'}

async function requestJson(url,options={}){
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),15000)
  try{
    const res=await fetch(url,{...options,credentials:'include',cache:'no-store',signal:controller.signal})
    const type=res.headers.get('content-type')||''
    const data=type.includes('application/json')?await res.json():{error:`Unexpected server response (${res.status})`}
    if(!res.ok) throw new Error(data.error||`Request failed (${res.status})`)
    return data
  }finally{clearTimeout(timer)}
}

export default function LmsPortal({mode='portal'}){
  const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true)
  const [selectedTab,setSelectedTab]=useState('overview')
  const [ward,setWard]=useState({name:'',dob:'',school:'',level:'',subjects:'',notes:''})
  const [assignment,setAssignment]=useState({enrollment_id:'',title:'',instructions:'',due_date:'',total_points:100,file:null})
  const [submissions,setSubmissions]=useState({})
  const [grades,setGrades]=useState({})

  async function load(){
    setLoading(true);setError('')
    try{const result=await requestJson('/api/lms?action=overview');setData(result)}
    catch(e){setError(e.name==='AbortError'?'The learning portal took too long to respond. Please retry.':e.message||'Unable to load the learning portal.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{load()},[])

  const role=data?.user?.role
  const learner=role==='parent'||role==='student'
  const stats=useMemo(()=>{
    if(!data)return[]
    const graded=(data.submissions||[]).filter(s=>s.status==='graded')
    const avg=graded.length?Math.round(graded.reduce((sum,s)=>sum+Number(s.score||0),0)/graded.length):0
    return role==='admin'
      ? [['Learners',data.wards?.length||0,'👨‍👩‍👧'],['Enrollments',data.enrollments?.length||0,'🎓'],['Assignments',data.assignments?.length||0,'📝'],['Submissions',data.submissions?.length||0,'📥']]
      : [['My wards',data.wards?.length||0,'👨‍👩‍👧'],['Active enrollments',(data.enrollments||[]).filter(e=>e.status==='active').length,'🎓'],['Assignments',data.assignments?.length||0,'📝'],['Average',`${avg}%`,'📈']]
  },[data,role])

  async function post(form,success){
    setError('');setNotice('')
    try{await requestJson('/api/lms',{method:'POST',body:form});setNotice(success);await load()}
    catch(e){setError(e.message||'Action failed')}
  }
  function enrollWard(e){e.preventDefault();const f=new FormData();f.append('action','create_ward');Object.entries(ward).forEach(([k,v])=>f.append(k,v));post(f,'Ward enrolled. The administrator can now assign a tutor.')}
  function createAssignment(e){e.preventDefault();const f=new FormData();f.append('action','create_assignment');Object.entries(assignment).forEach(([k,v])=>{if(v!==null&&v!==undefined&&v!=='')f.append(k,v)});post(f,'Assignment published successfully.')}
  function submitAssignment(e,a){e.preventDefault();const s=submissions[a.id]||{};const f=new FormData();f.append('action','submit_assignment');f.append('assignment_id',a.id);f.append('answer_text',s.answer_text||'');if(s.file)f.append('file',s.file);post(f,'Assignment submitted for marking.')}
  function gradeSubmission(e,s){e.preventDefault();const g=grades[s.id]||{};const f=new FormData();f.append('action','grade_submission');f.append('submission_id',s.id);f.append('score',g.score||'');f.append('feedback',g.feedback||'');post(f,'Result posted to the learner portal.')}
  function assignTutor(id,tutor){const f=new FormData();f.append('action','assign_tutor');f.append('enrollment_id',id);f.append('tutor_id',tutor);f.append('status','active');post(f,'Tutor assigned and enrollment activated.')}
  function toggleEnrollment(id,status){const f=new FormData();f.append('action','update_enrollment');f.append('enrollment_id',id);f.append('status',status);post(f,`Enrollment ${status}.`)}
  function removeWard(id){if(!confirm('Remove this ward and all associated LMS records?'))return;const f=new FormData();f.append('action','delete_ward');f.append('ward_id',id);post(f,'Ward removed.')}

  if(loading)return <div style={{minHeight:'100vh',background:'#f8fafc'}}><Header/><main className="container" style={{padding:'60px 20px'}}><div style={{...card,textAlign:'center',padding:'50px'}}><div style={{fontSize:42,marginBottom:12}}>🎓</div><h1 style={{margin:'0 0 8px'}}>Opening your Learning Portal</h1><p style={{color:'#64748b'}}>Securely loading your learning data…</p><div style={{margin:'22px auto',width:180,height:6,borderRadius:99,background:'#e2e8f0',overflow:'hidden'}}><div style={{height:'100%',width:'65%',background:'#2563eb',borderRadius:99,animation:'lmsPulse 1.2s ease-in-out infinite'}}/></div><style>{'@keyframes lmsPulse{0%,100%{transform:translateX(-40%)}50%{transform:translateX(80%)}}'}</style></div></main><Footer/></div>

  if(error&&!data)return <div style={{minHeight:'100vh',background:'#f8fafc'}}><Header/><main className="container" style={{padding:'60px 20px'}}><div style={{...card,textAlign:'center',padding:'50px'}}><div style={{fontSize:42}}>⚠️</div><h1>Learning Portal unavailable</h1><p style={{color:'#64748b',maxWidth:620,margin:'0 auto 20px'}}>{error}</p><button onClick={load} style={{...button,background:'#172554',color:'#fff'}}>Retry</button></div></main><Footer/></div>

  const title=role==='admin'?'LMS Control Center':role==='tutor'?'Tutor Workspace':role==='student'?'Student Learning Portal':'Parent Learning Portal'
  const subtitle=role==='admin'?'Run the entire learning operation from one place.':role==='tutor'?'Teach, assign, review and grade from one focused workspace.':role==='student'?'See your learning work, submit assignments and track results.':'Manage your wards, tutor assignments, coursework and results.'
  const assignments=data.assignments||[]

  return <div style={{minHeight:'100vh',background:'linear-gradient(180deg,#f8fafc 0%,#eef2ff 48%,#f8fafc 100%)'}}><Header/>
    <main className="container" style={{padding:'28px 20px 70px'}}>
      <section style={{...card,background:'linear-gradient(135deg,#0f172a,#1e3a8a 60%,#312e81)',color:'#fff',padding:'32px',overflow:'hidden',position:'relative'}}>
        <div style={{position:'relative',zIndex:1}}><div style={{fontSize:11,fontWeight:900,letterSpacing:2,textTransform:'uppercase',opacity:.68}}>The Modern Pedagogues • LMS</div><h1 style={{fontSize:'clamp(30px,5vw,48px)',margin:'8px 0',color:'#fff'}}>{title}</h1><p style={{maxWidth:720,margin:0,opacity:.84,fontSize:16}}>{subtitle}</p></div>
        <div style={{position:'absolute',right:-50,bottom:-100,width:280,height:280,borderRadius:'50%',background:'rgba(255,255,255,.08)'}}/>
      </section>

      {error&&<div style={{...card,marginTop:16,borderColor:'#fecaca',background:'#fff7f7',color:'#991b1b'}}>⚠ {error}</div>}
      {notice&&<div style={{...card,marginTop:16,borderColor:'#bbf7d0',background:'#f0fdf4',color:'#166534'}}>✓ {notice}</div>}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:14,marginTop:18}}>{stats.map(([label,value,icon])=><div key={label} style={card}><div style={{fontSize:24}}>{icon}</div><div style={{fontSize:12,color:'#64748b',fontWeight:800,textTransform:'uppercase',letterSpacing:.5,marginTop:8}}>{label}</div><div style={{fontSize:30,fontWeight:900,color:'#172554',marginTop:3}}>{value}</div></div>)}</div>

      <nav style={{...card,marginTop:18,padding:8,display:'flex',gap:6,flexWrap:'wrap'}}>{['overview',...(learner&&role==='parent'?['enroll']:[]),...(role==='tutor'?['teach']:[]),...(role==='admin'?['manage','teach']:[])].map(tab=><button key={tab} onClick={()=>setSelectedTab(tab)} style={{...button,background:selectedTab===tab?'#172554':'transparent',color:selectedTab===tab?'#fff':'#475569',textTransform:'capitalize'}}>{tab}</button>)}</nav>

      {learner&&selectedTab==='enroll'&&role==='parent'&&<section style={{...card,marginTop:18}}><h2 style={{margin:'0 0 5px'}}>Enroll a ward</h2><p style={{color:'#64748b',marginTop:0}}>Create the learner profile once. An administrator will match a tutor and activate the enrollment.</p><form onSubmit={enrollWard} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12,marginTop:18}}>{[['name','Ward full name','text'],['dob','Date of birth','date'],['school','School','text'],['level','Class / level','text'],['subjects','Subjects','text']].map(([k,label,type])=><label key={k} style={{fontSize:13,fontWeight:800,color:'#334155'}}>{label}<input required={k==='name'} type={type} value={ward[k]} onChange={e=>setWard({...ward,[k]:e.target.value})} style={input}/></label>)}<label style={{gridColumn:'1/-1',fontSize:13,fontWeight:800,color:'#334155'}}>Learning notes<textarea value={ward.notes} onChange={e=>setWard({...ward,notes:e.target.value})} style={{...input,minHeight:90}}/></label><button style={{...button,background:'#2563eb',color:'#fff'}}>Enroll Ward</button></form></section>}

      {role==='admin'&&selectedTab==='manage'&&<section style={{...card,marginTop:18}}><h2 style={{margin:'0 0 5px'}}>Enrollment command center</h2><p style={{color:'#64748b'}}>Every ward, tutor assignment and enrollment state is visible here.</p><div style={{display:'grid',gap:10,marginTop:15}}>{(data.enrollments||[]).map(e=><div key={e.id} style={{display:'grid',gridTemplateColumns:'1.3fr 1fr auto auto',gap:10,alignItems:'center',padding:14,border:'1px solid #e2e8f0',borderRadius:16,background:'#f8fafc'}}><div><strong>{e.ward_name}</strong><div style={{fontSize:12,color:'#64748b',marginTop:4}}>Status: {e.status} • Tutor: {e.tutor_name||'Unassigned'}</div></div><select style={input} defaultValue={e.tutor_id||''} onChange={ev=>ev.target.value&&assignTutor(e.id,ev.target.value)}><option value="">Assign tutor…</option>{(data.tutors||[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><button style={{...button,background:'#fff',border:'1px solid #cbd5e1',color:'#334155'}} onClick={()=>toggleEnrollment(e.id,e.status==='active'?'suspended':'active')}>{e.status==='active'?'Suspend':'Activate'}</button><button style={{...button,background:'#fff',border:'1px solid #fecaca',color:'#b91c1c'}} onClick={()=>removeWard(e.ward_id)}>Remove</button></div>)}{!data.enrollments?.length&&<p style={{color:'#64748b'}}>No enrollments yet.</p>}</div></section>}

      {(role==='tutor'||role==='admin')&&selectedTab==='teach'&&<section style={{...card,marginTop:18}}><h2 style={{margin:'0 0 5px'}}>Assignment studio</h2><p style={{color:'#64748b'}}>Create a properly attached assignment and deliver it directly to the selected learner.</p><form onSubmit={createAssignment} encType="multipart/form-data" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12,marginTop:16}}><label style={{fontSize:13,fontWeight:800}}>Learner / enrollment<select required value={assignment.enrollment_id} onChange={e=>setAssignment({...assignment,enrollment_id:e.target.value})} style={input}><option value="">Select enrollment</option>{(data.enrollments||[]).map(e=><option key={e.id} value={e.id}>{e.ward_name} — {e.tutor_name||'Unassigned'}</option>)}</select></label><label style={{fontSize:13,fontWeight:800}}>Assignment title<input required value={assignment.title} onChange={e=>setAssignment({...assignment,title:e.target.value})} style={input}/></label><label style={{fontSize:13,fontWeight:800}}>Due date<input type="datetime-local" value={assignment.due_date} onChange={e=>setAssignment({...assignment,due_date:e.target.value})} style={input}/></label><label style={{fontSize:13,fontWeight:800}}>Total points<input type="number" min="1" value={assignment.total_points} onChange={e=>setAssignment({...assignment,total_points:e.target.value})} style={input}/></label><label style={{gridColumn:'1/-1',fontSize:13,fontWeight:800}}>Instructions<textarea value={assignment.instructions} onChange={e=>setAssignment({...assignment,instructions:e.target.value})} style={{...input,minHeight:110}}/></label><label style={{fontSize:13,fontWeight:800}}>Assignment file<input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" onChange={e=>setAssignment({...assignment,file:e.target.files?.[0]||null})} style={input}/></label><div style={{display:'flex',alignItems:'end'}}><button style={{...button,background:'#2563eb',color:'#fff'}}>Publish Assignment</button></div></form></section>}

      <section style={{...card,marginTop:18}}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap'}}><div><h2 style={{margin:0}}>{learner?'My coursework':'Coursework & submissions'}</h2><p style={{margin:'5px 0 0',color:'#64748b'}}>Assignments, files, submissions and results stay in one secure record.</p></div></div><div style={{display:'grid',gap:13,marginTop:16}}>{assignments.map(a=><article key={a.id} style={{border:'1px solid #e2e8f0',borderRadius:18,padding:16,background:'#fff'}}><div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><h3 style={{margin:'0 0 5px'}}>{a.title}</h3><div style={{fontSize:13,color:'#64748b'}}>{a.ward_name} • {a.total_points} points {a.due_date&&`• Due ${new Date(a.due_date).toLocaleString()}`}</div></div>{a.file_path&&<a href={`/api/lms-download?kind=assignment&id=${a.id}`} className="btn ghost">Download assignment</a>}</div>{a.instructions&&<p style={{whiteSpace:'pre-wrap',color:'#475569'}}>{a.instructions}</p>}
        {learner&&<form onSubmit={e=>submitAssignment(e,a)} style={{display:'grid',gap:9,marginTop:12,paddingTop:12,borderTop:'1px solid #f1f5f9'}}><textarea placeholder="Optional answer or notes" value={submissions[a.id]?.answer_text||''} onChange={e=>setSubmissions({...submissions,[a.id]:{...(submissions[a.id]||{}),answer_text:e.target.value}})} style={{...input,minHeight:80}}/><input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" onChange={e=>setSubmissions({...submissions,[a.id]:{...(submissions[a.id]||{}),file:e.target.files?.[0]||null}})} style={input}/><button style={{...button,background:'#172554',color:'#fff'}}>Submit for marking</button></form>}
        {(role==='tutor'||role==='admin')&&<div style={{marginTop:13,display:'grid',gap:9}}>{(data.submissions||[]).filter(s=>s.assignment_id===a.id).map(s=><div key={s.id} style={{padding:13,borderRadius:14,background:'#f8fafc',border:'1px solid #e2e8f0'}}><div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}><strong>{s.ward_name}</strong><span style={{fontSize:12,color:'#64748b'}}>{s.status}</span></div>{s.answer_text&&<p style={{margin:'7px 0'}}>{s.answer_text}</p>}{s.file_path&&<a href={`/api/lms-download?kind=submission&id=${s.id}`}>Open submitted file</a>}{s.status==='graded'?<div style={{marginTop:8}}><strong>Result: {s.score}%</strong><p style={{margin:'4px 0',color:'#475569'}}>{s.feedback||'No written feedback.'}</p></div>:<form onSubmit={e=>gradeSubmission(e,s)} style={{display:'grid',gridTemplateColumns:'110px 1fr auto',gap:8,marginTop:9}}><input type="number" min="0" max="100" placeholder="Score" value={grades[s.id]?.score||''} onChange={e=>setGrades({...grades,[s.id]:{...(grades[s.id]||{}),score:e.target.value}})} style={input}/><input placeholder="Feedback" value={grades[s.id]?.feedback||''} onChange={e=>setGrades({...grades,[s.id]:{...(grades[s.id]||{}),feedback:e.target.value}})} style={input}/><button style={{...button,background:'#2563eb',color:'#fff'}}>Post result</button></form>}</div>)}</div>}</article>)}</div>{!assignments.length&&<div style={{padding:'30px 10px',textAlign:'center',color:'#64748b'}}>No coursework has been assigned yet.</div>}</section>
    </main><Footer/></div>
}
