import Header from '../components/Header'
import Footer from '../components/Footer'
import useSWR from 'swr'
import { swrFetcher } from '../lib/api'

export default function Curriculum(){
  const { data: products, error } = useSWR('/api/products', swrFetcher)

  async function addToCart(id){
    const body = new URLSearchParams({ id })
    await fetch('/api/cart/add',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body})
    alert('Added to cart')
  }

  return (
    <div>
      <Header />
      <main className="container">
        <div className="glass" style={{padding:20,marginTop:18}}>
          <h1>Curriculum & Resources</h1>
          <p className="muted">Browse our curriculum resources and purchase books and materials.</p>
        </div>

        <section style={{marginTop:18}}>
          <div className="product-grid">
            {error ? <div className="muted">Could not load products</div> : products ? products.map(p=> (
              <div key={p.id} className="product glass">
                <img src={p.image || '/images/book-placeholder.svg'} alt={p.title} />
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div className="title">{p.title}</div>
                  <div className="price-badge">GHS {p.price}</div>
                </div>
                <div className="muted">{p.description}</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
                  <button className="btn" onClick={()=>addToCart(p.id)}>Add to cart</button>
                  <a href={`/product/${p.id}`} className="btn btn-ghost">Details</a>
                </div>
              </div>
            )): <p>Loading...</p>}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
