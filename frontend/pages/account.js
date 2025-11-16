import Header from '../components/Header'
import Footer from '../components/Footer'
import { useEffect, useState } from 'react'

export default function Account(){
  const [session,setSession] = useState(null)

  useEffect(()=>{
    fetch('/api/session', {credentials:'include'}).then(r=>r.json()).then(d=>setSession(d)).catch(e=>{console.error(e); setSession({user:null})})
  },[])

  return (
    <div>
      <Header />
      <main className="container">
        <div className="glass" style={{padding:20,marginTop:18}}>
          <h1>My Account</h1>
          {session && session.user ? (
            <div>
              <div><strong>Name:</strong> {session.user.name || session.user.username || '—'}</div>
              <div className="muted">Email: {session.user.email || '—'}</div>
              <div style={{marginTop:8}}><a href="/logout">Log out</a></div>
            </div>
          ) : (
            <div className="muted">Not logged in. <a href="/login">Log in</a></div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
