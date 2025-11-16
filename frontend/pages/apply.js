import Header from '../components/Header'
import Footer from '../components/Footer'
import { useState } from 'react'

export default function Apply(){
  const [status,setStatus] = useState(null)
  const [fileName,setFileName] = useState('')
  async function submit(e){
    e.preventDefault()
    const fd = new FormData(e.target)
    // Apply requires file upload, keep FormData
    const res = await fetch('/apply', { method:'POST', body: fd, credentials: 'include' })
    if (res.ok) setStatus('sent')
    else setStatus('error')
  }
  return (
    <div>
      <Header />
      <main className="container">
        <div className="glass" style={{padding:20,marginTop:18,maxWidth:800}}>
          <h1>Apply as a Teacher</h1>
          {status==='sent' && <div className="notice success">Application received.</div>}
          <form onSubmit={submit} encType="multipart/form-data" style={{display:'grid',gap:8,marginTop:12}}>
            <input name="name" placeholder="Full name" required />
            <input name="email" type="email" placeholder="Email" required />
            <input name="phone" placeholder="Phone" />
            <textarea name="message" placeholder="Tell us about your experience" />
            <label className="file-input">
              <input name="cv" type="file" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e)=>setFileName(e.target.files[0]?.name||'')} />
              <div className="file-name">{fileName || 'Upload CV (PDF, DOC)'}</div>
            </label>
            <button className="btn" type="submit">Submit Application</button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  )
}
