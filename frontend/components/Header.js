import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'

function IconCart(){
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6h15l-1.5 9h-11L6 6z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="10" cy="20" r="1" fill="currentColor"/><circle cx="18" cy="20" r="1" fill="currentColor"/></svg>)
}

export default function Header(){
  const [open,setOpen] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [cartOpen, setCartOpen] = useState(false)
  const [cartItems, setCartItems] = useState([])
  const cartRef = useRef(null)
  const navRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)
  const [renderCart, setRenderCart] = useState(false)
  // close mobile menu on resize > 900
  useEffect(()=>{
    async function fetchCart(){
      try {
        const s = await fetch('/api/session', { credentials: 'include' });
        const js = await s.json();
        const count = js.cart ? Object.values(js.cart).reduce((a,b)=>a+Number(b||0),0) : 0;
        setCartCount(count)
        if (count > 0) {
          const r = await fetch('/api/cart', { credentials: 'include' });
          const items = await r.json();
          setCartItems(items)
        }
      } catch (e) { }
    }
    fetchCart();
    function onResize(){
      const mobile = window.innerWidth < 900
      setIsMobile(mobile)
      if (!mobile) setOpen(false)
    }
    // initialize
    onResize()
    window.addEventListener('resize', onResize)
    return ()=>window.removeEventListener('resize', onResize)
  },[])
  
  // Manage render/unmount and animate mini-cart on open/close
  useEffect(()=>{
    const el = cartRef.current;
    if (cartOpen) {
      setRenderCart(true);
      // ensure element is visible then add show class
      requestAnimationFrame(()=>{
        if (el) el.classList.add('show');
      });
      return;
    }
    // closing: remove show class and unmount after transition
    if (!cartOpen && el) {
      el.classList.remove('show');
      const onEnd = ()=>{
        setRenderCart(false);
        el.removeEventListener('transitionend', onEnd);
      };
      el.addEventListener('transitionend', onEnd);
    } else if (!cartOpen) {
      setRenderCart(false);
    }
  },[cartOpen])

  // Close mini-cart on Escape or click outside, and close mobile nav on Escape/click-outside
  useEffect(()=>{
    function onKey(e){ if (e.key === 'Escape') { setCartOpen(false); setOpen(false); } }
    function onDown(e){
      // cart
      if (cartOpen) {
        const el = cartRef.current;
        if (el && !el.contains(e.target) && !e.target.closest('a[href="/cart"]')) setCartOpen(false);
      }
      // nav
      if (open) {
        const hdr = navRef.current;
        if (hdr && !hdr.contains(e.target) && !e.target.closest('.nav-toggle')) setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('pointerdown', onDown);
    return ()=>{
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('pointerdown', onDown);
    }
  },[cartOpen, open])

  return (
    <header ref={navRef} className={"site-header" + (open? ' nav-open':'')}>
      <div className="nav-inner container">
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div className="brand"><span className="logo" />The Modern Pedagogues</div>
        </div>

        <button className="nav-toggle" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 7h18M3 12h18M3 17h18" stroke="#083344" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        <nav className="nav-links" aria-hidden={!open && isMobile ? 'true' : 'false'}>
          <Link href="/">Home</Link>
          <Link href="/curriculum">Curriculum</Link>
          <Link href="/estore">E-Store</Link>
          <Link href="/tutors">Tutors</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/apply">Apply</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <a role="button" onClick={(e)=>{ e.preventDefault(); setCartOpen(!cartOpen) }} style={{display:'inline-flex',alignItems:'center',gap:8,cursor:'pointer'}}><IconCart/>Cart{cartCount>0? <span className="badge">{cartCount}</span>:null}</a>
          {renderCart && (
            <div ref={cartRef} className="mini-cart" style={{position:'absolute',right:20,top:64,background:'#fff',border:'1px solid rgba(12,15,20,0.06)',padding:12,borderRadius:8,width:300,zIndex:60}}>
              {cartItems && cartItems.length ? (
                <div>
                <button onClick={() => setCartOpen(false)} className="close-btn" aria-label="Close" style={{position:'absolute',right:8,top:8,border:0,background:'transparent',fontSize:18,cursor:'pointer'}}>×</button>
                  <ul style={{listStyle:'none',padding:0,margin:0}}>
                    {cartItems.map(it=> (
                      <li key={it.id} style={{padding:'6px 0',borderBottom:'1px solid rgba(12,15,20,0.03)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <div>{it.title}</div>
                          <div style={{display:'flex',gap:8,alignItems:'center'}}>
                            <div className="muted">{it.qty} × GHS {it.price}</div>
                            <button onClick={async ()=>{
                              try {
                                await fetch('/api/cart/remove', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:it.id}), credentials: 'include'});
                                  const r = await fetch('/api/cart', { credentials: 'include' });
                                  const items = await r.json();
                                  setCartItems(items);
                                  const s = await fetch('/api/session', { credentials: 'include' });
                                  const js = await s.json();
                                  const count = js.cart ? Object.values(js.cart).reduce((a,b)=>a+Number(b||0),0) : 0;
                                  setCartCount(count);
                              } catch(e){}
                            }} className="btn-link small">Deselect</button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div style={{marginTop:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <a href="/cart" className="btn">View cart</a>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <button className="btn alt" onClick={async ()=>{
                        try {
                          await fetch('/api/cart/clear', {method:'POST', credentials: 'include'});
                          setCartItems([]);
                          setCartCount(0);
                        } catch(e){}
                      }}>Clear cart</button>
                      <a href="/checkout" className="btn ghost">Checkout</a>
                      <button className="btn ghost" onClick={() => setCartOpen(false)}>Cancel</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="muted">Your cart is empty.</div>
              )}
            </div>
          )}
          <Link href="/login">Login</Link>
        </nav>
      </div>
    </header>
  )
}
