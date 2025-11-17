import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { useRouter } from 'next/router'
import useSWR from 'swr'
import { swrFetcher } from '../../lib/api'
import { useState } from 'react'

export default function ProductPage(){
  const router = useRouter()
  const { id } = router.query
  const { data: products, error } = useSWR(id ? '/api/products' : null, swrFetcher)

  if (!id) return null
  if (error) return (<div><Header/><main className="container"><div className="glass" style={{padding:20,marginTop:18}}>Could not load product details.</div></main><Footer/></div>)
  const product = products ? products.find(p=>p.id === id) : null

  const [qty, setQty] = useState(1)

  async function addToCart(){
    const body = new URLSearchParams({ id, quantity: qty })
    await fetch('/api/cart/add',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body, credentials: 'include'})
    alert('Added to cart')
    try { window.dispatchEvent(new CustomEvent('cart:updated')) } catch(e) {}
  }

  return (
    <div>
      <Header />
      <main className="container">
        <div className="glass" style={{padding:20,marginTop:18}}>
          {product ? (
            <div style={{display:'flex',gap:20,alignItems:'flex-start'}}>
              <img src={product.image || '/placeholder.jpg'} alt={product.title} style={{width:240}} />
                <div>
                <h1>{product.title}</h1>
                <div className="muted">GHS {product.price}</div>
                <p style={{marginTop:12}}>{product.description}</p>
                <div style={{marginTop:18,display:'flex',gap:12,alignItems:'center'}}>
                  <label style={{display:'flex',alignItems:'center',gap:8}}>
                    Qty
                    <input type="number" min="1" value={qty} onChange={e=>setQty(Math.max(1,parseInt(e.target.value||1)))} style={{width:72,padding:6}} />
                  </label>
                  <button className="btn" onClick={addToCart}>Add to cart</button>
                </div>
              </div>
            </div>
          ) : <p>Loading...</p>}
        </div>
        {products && product && (
          <section style={{marginTop:18}}>
            <h3>Related resources</h3>
            <div className="product-grid">
              {products.filter(p => p.id !== id).slice(0,4).map(p => (
                <div key={p.id} className="product glass">
                  <img src={p.image_path || p.image || '/images/book-placeholder.svg'} alt={p.title} />
                  <div className="title">{p.title}</div>
                  <div className="muted">GHS {p.price}</div>
                  <div style={{display:'flex',gap:8,marginTop:8}}>
                    <a href={`/product/${p.id}`} className="btn">View</a>
                    <button className="btn" onClick={async ()=>{ const b=new URLSearchParams({ id: p.id, quantity: 1}); await fetch('/api/cart/add',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:b, credentials: 'include'}); alert('Added'); try { window.dispatchEvent(new CustomEvent('cart:updated')) } catch(e) {} }}>Add</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}
