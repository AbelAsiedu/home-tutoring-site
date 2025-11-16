import useSWR from 'swr'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { swrFetcher } from '../../lib/api'
import { useState } from 'react'

export default function TutorLessons(){
  const { data: lessons, mutate } = useSWR('/api/lessons', swrFetcher)
  const [selected, setSelected] = useState(null)

  async function open(id){
    const res = await fetch(`/api/lessons/${id}`, {credentials:'include'})
    if (!res.ok) return alert('Could not load lesson')
    const json = await res.json(); setSelected(json)
  }

  async function submitReport(e){
    e.preventDefault();
    const form = e.target; const fd = new FormData(form);
    const body = { summary: fd.get('summary'), homework: fd.get('homework'), progress_score: fd.get('progress_score') };
    const res = await fetch(`/api/lessons/${selected.lesson.id}/report`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'include'});
    if (!res.ok) return alert('Error submitting report');
    alert('Report submitted');
    form.reset();
    mutate();
  }

  async function uploadRecording(e){
    e.preventDefault();
    const form = e.target; const fd = new FormData(form);
    const res = await fetch(`/api/lessons/${selected.lesson.id}/recording`, {method:'POST',body:fd,credentials:'include'});
    if (!res.ok) return alert('Upload failed');
    alert('Recording uploaded');
    form.reset();
    mutate();
  }

  return (
    <div>
      <Header />
      <main className="container">
        <h1>Your lessons</h1>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:12}}>
          {lessons ? lessons.map(l=> (
            <div key={l.id} className="card glass" style={{padding:12}}>
              <div><strong>{new Date(l.scheduled_at).toLocaleString()}</strong></div>
              <div className="muted">Student: {l.student_id || '—'}</div>
              <div style={{marginTop:8}}><button className="btn" onClick={()=>open(l.id)}>Open</button></div>
            </div>
          )) : <div>Loading lessons...</div>}
        </div>

        {selected && (
          <section style={{marginTop:18}}>
            <h2>Lesson: {new Date(selected.lesson.scheduled_at).toLocaleString()}</h2>
            <div className="card glass" style={{padding:12}}>
              <h4>Post report</h4>
              <form onSubmit={submitReport}>
                <textarea name="summary" placeholder="Summary" required style={{width:'100%',minHeight:80}} />
                <input name="homework" placeholder="Homework" style={{width:'100%',marginTop:8}} />
                <input name="progress_score" placeholder="Score (0-10)" style={{width:160,marginTop:8}} />
                <div style={{marginTop:8}}><button className="btn">Submit report</button></div>
              </form>

              <h4 style={{marginTop:12}}>Upload recording</h4>
              <form onSubmit={uploadRecording} encType="multipart/form-data">
                <input type="file" name="recording" accept="audio/*,video/*" required />
                <input name="notes" placeholder="Notes" style={{width:'100%',marginTop:8}} />
                <div style={{marginTop:8}}><button className="btn">Upload</button></div>
              </form>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}
