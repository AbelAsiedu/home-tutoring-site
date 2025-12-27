import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function Header(){
  const [cartCount, setCartCount] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(()=>{
    function updateCount(){
      try {
        const local = JSON.parse(window.localStorage.getItem('mp_cart') || '{}')
        const count = Object.values(local || {}).reduce((s,n)=>s + (Number(n)||0), 0)
        setCartCount(count)
      } catch(e){
        setCartCount(0)
      }
    }

    function onResize(){
      setIsMobile(window.innerWidth < 900)
    }

    updateCount()
    onResize()
    window.addEventListener('cart:updated', updateCount)
    window.addEventListener('resize', onResize)
    return ()=>{
      window.removeEventListener('cart:updated', updateCount)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <header className="site-header">
      <div className="nav-inner container">
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div className="brand"><span className="logo" />The Modern Pedagogues</div>
          <div className="nav-history" style={{display:'inline-flex',gap:6}}>
            <button type="button" aria-label="Go back" className="btn ghost" style={{padding:'6px 10px'}} onClick={()=>window.history.back()}>←</button>
            <button type="button" aria-label="Go forward" className="btn ghost" style={{padding:'6px 10px'}} onClick={()=>window.history.forward()}>→</button>
          </div>
        </div>

        <button className="nav-toggle" aria-label="Toggle menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 7h18M3 12h18M3 17h18" stroke="#083344" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        <nav className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/curriculum">Curriculum</Link>
          <Link href="/estore">E-Store</Link>
          <Link href="/tutors">Tutors</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/apply">Apply</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>

          <div style={{display:'inline-flex',alignItems:'center',gap:8}}>
            <Link href="/cart">
              <a style={{display:'inline-flex',alignItems:'center',gap:8}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6h15l-1.5 9h-11L6 6z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="10" cy="20" r="1" fill="currentColor"/><circle cx="18" cy="20" r="1" fill="currentColor"/></svg>
                <span>Cart</span>
                <span className="cart-badge" style={{minWidth:18,display:'inline-block',textAlign:'center'}}>{cartCount || ''}</span>
              </a>
            </Link>
            <button aria-label="Open mini cart" style={{background:'transparent',border:0,cursor:'pointer',padding:6,fontSize:14}}>▾</button>
          </div>
        </nav>

        <div className="nav-actions">
          <a href="/login" className="btn ghost">Login</a>
          <a href="/signup" className="btn">Sign up</a>
        </div>
      </div>
    </header>
  )
}
