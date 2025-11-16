export default function Footer(){
  return (
    <footer className="site-footer">
      <div className="container">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
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
            <div style={{marginTop:8}}>
              <a href="#" className="muted" style={{marginRight:8}}>Privacy</a>
              <a href="#" className="muted">Cookies</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
