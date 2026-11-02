import { useEffect, useState } from 'react'

export default function Footer({ initialUser = null }){
  const [sessionUser, setSessionUser] = useState(initialUser)
  const [sessionLoaded, setSessionLoaded] = useState(true)

  useEffect(() => {
    fetch('/api/session', { credentials: 'include', cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => { setSessionUser(data?.user || null); setSessionLoaded(true) })
      .catch(() => setSessionLoaded(true))
  }, [])

  return (
    <footer className="site-footer">
      <div className="container">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,flexWrap:'wrap'}}>
          <div>
            <strong>The Modern Pedagogues</strong>
            <div className="muted">Empowering Lives, Changing Destinies.</div>
            <div style={{marginTop:8}}>
              <a href="/about" style={{marginRight:12}}>About</a>
              <a href="/contact" style={{marginRight:12}}>Contact</a>
              <a href="/curriculum">Curriculum</a>
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <a href="https://wa.me/233593660708" className="footer-whatsapp">WhatsApp: +233 59 366 0708</a>
            <div className="muted">© {new Date().getFullYear()} The Modern Pedagogues</div>
            <div style={{marginTop:4}}>
              <a href="/privacy" className="muted" style={{marginRight:8}}>Privacy</a>
              <a href="/privacy" className="muted">Cookies</a>
            </div>
          </div>
        </div>
        <div style={{textAlign:'center',marginTop:16,paddingTop:12,borderTop:'1px solid rgba(15,23,42,0.06)'}}>
          <div style={{display:'inline-flex',gap:10}}>
            <button type="button" id="dark-mode-toggle" className="btn ghost" title="Toggle dark/light mode" aria-label="Toggle dark mode">Dark mode</button>
            {sessionLoaded && sessionUser ? <><a href="/account" className="btn ghost">My Account</a><a href="/logout" className="btn">Log out</a></> : sessionLoaded ? <><a href="/login" className="btn ghost">Login</a><a href="/signup" className="btn">Sign up</a></> : null}
          </div>
        </div>
      </div>
    </footer>
  )
}
