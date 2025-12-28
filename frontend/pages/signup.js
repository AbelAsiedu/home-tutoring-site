import Header from '../components/Header'
import Footer from '../components/Footer'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { postUrlEncoded, validateEmail } from '../lib/formUtils'

export default function Signup(){
  const [error,setError]=useState(null)
  const router = useRouter()

  async function submit(e){
    e.preventDefault()
    const fd = new FormData(e.target)
    const payload = {
      name: fd.get('name'),
      email: fd.get('email'),
      password: fd.get('password'),
      acceptTerms: 'on',
      acceptPrivacy: 'on'
    }
    if (!validateEmail(payload.email)) return setError('Please enter a valid email')
    const res = await postUrlEncoded('/signup', payload)
    if (res.ok) {
      router.push('/login?success=' + encodeURIComponent('Account created. Please log in.'))
    } else {
      setError('Could not create account')
    }
  }
  return (
    <div>
      <Header />
      <main className="container">
        <div className="glass" style={{padding:20,marginTop:18,maxWidth:600}}>
          <h1>Sign up</h1>
          {error && <div style={{color:'crimson'}}>{error}</div>}
          <form onSubmit={submit} style={{display:'grid',gap:10,marginTop:12}}>
            <input name="name" placeholder="Full name" required />
            <input name="email" type="email" placeholder="Email" required />
            <input name="password" type="password" placeholder="Password" required />
            <button className="btn" type="submit">Create account</button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  )
}
