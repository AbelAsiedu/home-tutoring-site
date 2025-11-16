import Header from '../components/Header'
import Footer from '../components/Footer'
import useSWR from 'swr'
import { useState } from 'react'
import { swrFetcher } from '../lib/api'

export default function Cart() {
  const { data: items, error, mutate } = useSWR('/api/cart', swrFetcher)
  const [phone, setPhone] = useState('')

  async function checkout() {
    const res = await fetch('/api/checkout', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ payment_method: 'momo', momo_number: phone }) })
    const json = await res.json()
    if (json.orderId) alert('Order placed: ' + json.orderId)
    else if (json.stripeUrl) window.location = json.stripeUrl
    mutate()
  }

  return (
    <div>
      <Header />
      <main className="container">
        <div className="glass" style={{padding:20,marginTop:18}}>
          <h1>Your Cart</h1>
          {error ? <div className="muted">Could not load cart (backend unreachable)</div> : !items ? <p>Loading...</p> : items.length === 0 ? <p className="muted">Cart empty</p> : (
            <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16}}>
              <div>
                {items.map(i => (
                  <div key={i.id} className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:12}}>
                    <div>
                      <strong>{i.title}</strong>
                      <div className="muted">Qty: {i.qty}</div>
                    </div>
                    <div style={{display:'flex',gap:12,alignItems:'center'}}>
                      <div style={{fontWeight:700}}>GHS {(i.price * i.qty).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <aside className="summary">
                <h3>Order Summary</h3>
                {items.map(i => (
                  <div className="row" key={i.id}><div>{i.title} x{i.qty}</div><div>GHS {(i.price * i.qty).toFixed(2)}</div></div>
                ))}
                <div className="row total"><div>Total</div><div>GHS {items.reduce((s,i)=>s + i.price * i.qty,0).toFixed(2)}</div></div>
                <div style={{marginTop:12}}>
                  <a href="/checkout" className="cta" style={{display:'block',textAlign:'center',padding:'10px 12px',borderRadius:8}}>Proceed to checkout</a>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
