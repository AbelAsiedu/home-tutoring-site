import useSWR from 'swr'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { swrFetcher } from '../lib/api'

export default function EStore({ initialProducts }) {
  const { data: products, error } = useSWR('/api/products', swrFetcher, { fallbackData: initialProducts })

  async function addToCart(id) {
    const body = new URLSearchParams({ id })
    await fetch('/api/cart/add', { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body, credentials: 'include' })
    alert('Added to cart')
    try { window.dispatchEvent(new CustomEvent('cart:updated')) } catch(e) {}
    try {
      const links = Array.from(document.querySelectorAll('.site-header a, .site-header [role="button"]'))
      const cartLink = links.find(el => /cart/i.test((el.innerText||'')))
      if (cartLink) {
        let b = cartLink.querySelector('.badge')
        if (!b) { b = document.createElement('span'); b.className = 'badge'; cartLink.appendChild(b) }
        b.innerText = String((parseInt(b.innerText||'0',10) || 0) + 1)
      }
    } catch(e) {}
  }

  return (
    <div>
      <Header />
      <section className="hero-slideshow" style={{height:220}}>
        <div className="hero-slideshow-inner" style={{position:'relative',height:'100%'}}>
          <div className="slide"><img loading="lazy" src="/images/slide2.svg" alt="slide-1" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
          <div className="slide"><img loading="lazy" src="/images/hero-illustration.svg" alt="slide-2" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
          <div className="slide"><img loading="lazy" src="/images/slide2.svg" alt="slide-3" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
        </div>
      </section>
      <main className="container">
        <div className="glass" style={{padding:20,marginTop:18}}>
          <h1>E-Store — Books & Resources</h1>
          <p className="muted">Shop course books, revision guides and digital resources. Click a product to view details and purchase.</p>
        </div>

        <section style={{marginTop:18}}>
          {products && products.length ? (
            <div className="product-grid">
              {products.map(p => (
                <div key={p.id} className="product glass" style={{display:'flex',flexDirection:'column'}}>
                  <img src={p.image_path || p.image || '/images/book-placeholder.svg'} alt={p.title} style={{width:'100%',height:180,objectFit:'cover'}} />
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
          ) : error ? (
            <div className="muted">The Modern Pedagogues</div>
          ) : (
            <p>Loading...</p>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}

export async function getServerSideProps(ctx) {
  // In SSR we should fetch the products from the same origin that handled this request.
  // Use the incoming host/proto information when available so this works behind proxies
  // and when Next is served together with Express.
  try {
    const { req } = ctx;
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${process.env.PORT || 3001}`;
    const base = `${proto}://${host}`;
    const res = await fetch(`${base}/api/products`);
    const products = await res.json();
    return { props: { initialProducts: products } };
  } catch (e) {
    try {
      // final fallback: try local port
      const port = process.env.PORT || 3001;
      const res2 = await fetch(`http://localhost:${port}/api/products`);
      const products2 = await res2.json();
      return { props: { initialProducts: products2 } };
    } catch (err) {
      return { props: { initialProducts: [] } };
    }
  }
}
