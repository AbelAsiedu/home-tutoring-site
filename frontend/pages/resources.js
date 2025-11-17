import useSWR from 'swr'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { swrFetcher } from '../lib/api'

export default function Resources() {
  const { data: products, error } = useSWR('/api/products', swrFetcher)

  async function addToCart(id) {
    const body = new URLSearchParams({ id })
    await fetch('/api/cart/add', { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body, credentials: 'include' })
    alert('Added to cart')
    try { window.dispatchEvent(new CustomEvent('cart:updated')) } catch(e) {}
  }

  return (
    <div>
      <Header />
      <main className="container">
        <div className="glass" style={{padding:20,marginTop:18}}>
          <h1>Shop — Coursebooks & Resources</h1>
          <p className="muted">Browse our curated collection of course books, workbooks, and digital resources. Click a product to view details and purchase.</p>
        </div>

        <section style={{marginTop:18}}>
          {error ? (
            <div className="muted">Could not load products (backend unreachable)</div>
          ) : products ? (
            <div className="product-grid">
              {products.map(p => (
                <div key={p.id} className="product glass" style={{display:'flex',flexDirection:'column'}}>
                  <img src={p.image || '/images/book-placeholder.svg'} alt={p.title} style={{width:'100%',height:180,objectFit:'cover'}} />
                  <div style={{padding:'12px',flex:1,display:'flex',flexDirection:'column'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                      <div style={{fontWeight:700}}>{p.title}</div>
                      <div style={{fontSize:16,fontWeight:700}}>GHS {p.price}</div>
                    </div>
                    <div className="muted" style={{marginTop:8,flex:1}}>{p.description || 'No description available.'}</div>
                    <div style={{marginTop:12,display:'flex',gap:10}}>
                      <Link href={`/product/${p.id}`} className="btn">View</Link>
                      <button onClick={() => addToCart(p.id)} className="btn">Add to cart</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>Loading...</p>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
