import useSWR from 'swr'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { swrFetcher } from '../lib/api'
import { useState } from 'react'

export default function Dashboard(){
  const { data, error } = useSWR('/api/dashboard', swrFetcher)
  const { data: lessons } = useSWR('/api/lessons', swrFetcher)
  const [selectedLesson, setSelectedLesson] = useState(null)

  async function viewLesson(id){
    const res = await fetch(`/api/lessons/${id}`, {credentials:'include'})
    if (!res.ok) return alert('Could not load lesson')
    const json = await res.json()
    setSelectedLesson(json)
  }

  if (error) return <div><Header /><main className="container"><p className="muted">Could not load dashboard.</p></main><Footer /></div>
  if (!data) return <div><Header /><main className="container"><p>Loading...</p></main><Footer /></div>

  return (
    <div>
      <Header />
      <main className="container">
        <h1>Your dashboard</h1>
        <section style={{marginTop:18}}>
          <h2>Upcoming lessons</h2>
          {data.upcoming && data.upcoming.length ? (
            <div className="product-grid">
              {data.upcoming.map(l => (
                <div key={l.id} className="card glass" style={{padding:12}}>
                  <div><strong>{new Date(l.scheduled_at).toLocaleString()}</strong></div>
                  <div className="muted">Duration: {l.duration_minutes} mins</div>
                  <div style={{marginTop:8}}>
                    <button className="btn" onClick={()=>viewLesson(l.id)}>View</button>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="muted">No upcoming lessons.</div>}
        </section>

        <section style={{marginTop:18}}>
          <h2>Recent reports</h2>
          {data.recentReports && data.recentReports.length ? (
            <div className="product-grid">
              {data.recentReports.map(r => (
                <div key={r.id} className="card glass" style={{padding:12}}>
                  <div><strong>{new Date(r.created_at).toLocaleString()}</strong></div>
                  <div className="muted">Score: {r.progress_score || '—'}</div>
                  <div style={{marginTop:8}}>{r.summary}</div>
                </div>
              ))}
            </div>
          ) : <div className="muted">No reports yet.</div>}
        </section>

        <section style={{marginTop:18}}>
          <h2>Recent recordings</h2>
          {data.recentRecordings && data.recentRecordings.length ? (
            <div className="product-grid">
              {data.recentRecordings.map(r => (
                <div key={r.id} className="card glass" style={{padding:12}}>
                  <div className="muted">Uploaded: {new Date(r.uploaded_at).toLocaleString()}</div>
                  {r.url ? <audio controls src={r.url} style={{width:'100%',marginTop:8}} /> : <div className="muted">No recording file available</div>}
                  <div style={{marginTop:8}}>{r.notes}</div>
                </div>
              ))}
            </div>
          ) : <div className="muted">No recordings yet.</div>}
        </section>

        {selectedLesson && (
          <section style={{marginTop:18}}>
            <h2>Lesson details</h2>
            <div className="card glass" style={{padding:12}}>
              <div><strong>When:</strong> {new Date(selectedLesson.lesson.scheduled_at).toLocaleString()}</div>
              <div className="muted">Status: {selectedLesson.lesson.status}</div>
              <h4 style={{marginTop:8}}>Reports</h4>
              {selectedLesson.reports.length ? selectedLesson.reports.map(r=> (
                <div key={r.id} style={{marginTop:8}} className="muted">{r.summary} <div style={{fontSize:12}}>{r.homework}</div></div>
              )) : <div className="muted">No reports</div>}
              <h4 style={{marginTop:8}}>Recordings</h4>
              {selectedLesson.recordings.length ? selectedLesson.recordings.map(rc=> (
                <div key={rc.id} style={{marginTop:8}}>
                  {rc.url ? <audio controls src={rc.url} style={{width:'100%'}} /> : <div className="muted">No file</div>}
                  <div className="muted">{rc.notes}</div>
                </div>
              )) : <div className="muted">No recordings</div>}
            </div>
          </section>
        )}

      </main>
      <Footer />
    </div>
  )
}
