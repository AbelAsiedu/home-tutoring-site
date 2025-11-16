import Header from '../components/Header'
import Footer from '../components/Footer'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { postUrlEncoded } from '../lib/formUtils'

export default function Login(){
  const [error,setError]=useState(null)
  const router = useRouter()
  async function submit(e){
    e.preventDefault()
    const fd = new FormData(e.target)
    const payload = { username: fd.get('username'), password: fd.get('password') }
    await postUrlEncoded('/login', payload)
    // Check session to know if login succeeded
    const session = await fetch('/api/session', { credentials: 'include' }).then(r=>r.json())
    if (session && session.user) router.push('/account')
    else setError('Invalid credentials')
  }
  return (
    <div>
      <Header />
      <main className="container">
        <div className="glass" style={{padding:20,marginTop:18,maxWidth:600}}>
          <h1>Login</h1>
          {error && <div style={{color:'crimson'}}>{error}</div>}
          <form onSubmit={submit} style={{display:'grid',gap:10,marginTop:12}}>
            <input name="username" placeholder="Username or email" required />
            <input name="password" type="password" placeholder="Password" required />
            <button className="btn" type="submit">Log in</button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  )
}
