import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'

function IconCart(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 6h15l-1.5 9h-11L6 6z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="10" cy="20" r="1" fill="currentColor"/>
      <circle cx="18" cy="20" r="1" fill="currentColor"/>
    </svg>
  )
}

export default function Header(){
  const [open,setOpen] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [user, setUser] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [cartItems, setCartItems] = useState([])
  const cartRef = useRef(null)
  const navRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)
  const [renderCart, setRenderCart] = useState(false)

  useEffect(()=>{
    async function fetchCart(){
      try {
        )
      }
            setCartItems([]);
            setCartCount(0);
            return;
          }
          // fetch product details and map only existing products
          const r = await fetch(`/api/products`);
          const products = await r.json();
          const items = products.filter(p => ids.includes(p.id)).map(p => ({ ...p, qty: Number(local[p.id] || 0) }));
          const localCount = items.reduce((s,i)=>s + (Number(i.qty)||0), 0);
          if (!localCount) {
            // no valid items found in local fallback — clear stale fallback
            try { window.localStorage.removeItem('mp_cart') } catch(e) {}
            setCartItems([]);
            setCartCount(0);
            return;
          }
          setCartItems(items);
          setCartCount(localCount);
          return;
        } catch(e) {
          // graceful fallback
          setCartItems([]);
          setCartCount(0);
          return;
        }
      } catch (e) {
        // network or other error — keep UI stable
        try {
          const local = JSON.parse(window.localStorage.getItem('mp_cart') || '{}')
          const localCount = Object.values(local || {}).reduce((s,n)=>s + (Number(n)||0), 0);
          setCartCount(localCount);
        } catch (err) {
          setCartCount(0);
        }
      }
    }
    fetchCart();
    // listen for cart updates from other pages
    window.addEventListener('cart:updated', fetchCart)
    function onResize(){
      const mobile = window.innerWidth < 900
      setIsMobile(mobile)
      if (!mobile) setOpen(false)
    }
    // initialize
    onResize()
    import Link from 'next/link'

    // Minimal header component: simple, static layout to avoid build-time parsing issues.
    export default function Header(){
      return (
        <header className="site-header">
          <div className="nav-inner container">
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div className="brand"><span className="logo" />The Modern Pedagogues</div>
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
                <a href="/cart" style={{display:'inline-flex',alignItems:'center',gap:8}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6h15l-1.5 9h-11L6 6z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="10" cy="20" r="1" fill="currentColor"/><circle cx="18" cy="20" r="1" fill="currentColor"/></svg>
                  Cart
                </a>
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
