import Header from '../components/Header'
import Footer from '../components/Footer'
import { useState } from 'react'
import { postUrlEncoded, validateEmail } from '../lib/formUtils'

export default function Contact(){
  const [status,setStatus] = useState(null)

  async function submit(e){
    e.preventDefault()
    const fd = new FormData(e.target)
    const payload = { name: fd.get('name'), email: fd.get('email'), subject: fd.get('subject'), message: fd.get('message') }
    if (!validateEmail(payload.email)) return setStatus('invalid_email')
    const res = await postUrlEncoded('/contact', payload)
    if (res && res.ok) setStatus('sent')
    else setStatus('error')
  }
  return (
    <div>
      <Header />
      <main className="container">
        <div className="glass" style={{padding:20,marginTop:18}}>
          <h1>Contact Us</h1>
          {status==='sent' && <div style={{background:'#e6f9ee',padding:12,borderRadius:8}}>Message sent.</div>}
          <form onSubmit={submit} style={{display:'grid',gap:8,marginTop:12}}>
            <input name="name" placeholder="Your name" required />
            <input name="email" placeholder="Email" type="email" required />
            <input name="subject" placeholder="Subject" />
            <textarea name="message" placeholder="Message" required />
            <button className="btn" type="submit">Send Message</button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  )
}
