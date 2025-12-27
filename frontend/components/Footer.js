export default function Footer(){
  return (
    <footer className="site-footer">
      <div className="container">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,flexWrap:'wrap'}}>
          <div>
            <strong>The Modern Pedagogues</strong>
            <div className="muted">Practical tutoring, modern pedagogy.</div>
            <div style={{marginTop:8}}>
              <a href="/about" style={{marginRight:12}}>About</a>
              <a href="/contact" style={{marginRight:12}}>Contact</a>
              <a href="/curriculum">Curriculum</a>
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div className="muted">© {new Date().getFullYear()} The Modern Pedagogues</div>
            <div style={{marginTop:4}}>
              <a href="/privacy" className="muted" style={{marginRight:8}}>Privacy</a>
              <a href="/privacy" className="muted">Cookies</a>
            </div>
          </div>
        </div>
        <div style={{textAlign:'center',marginTop:16,paddingTop:12,borderTop:'1px solid rgba(15,23,42,0.06)'}}>
          <div style={{display:'inline-flex',gap:10}}>
            <a href="/login" className="btn ghost">Login</a>
            <a href="/signup" className="btn">Sign up</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
