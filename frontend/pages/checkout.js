import Header from '../components/Header'
import Footer from '../components/Footer'
import useSWR from 'swr'
import { useState } from 'react'
import { postUrlEncoded, validateRequired } from '../lib/formUtils'
import { swrFetcher } from '../lib/api'
const fetcher = (url) => fetch(url, {credentials:'include'}).then(r=>r.json())

export default function Checkout(){
  const { data: items, error } = useSWR('/api/cart', swrFetcher)
  const [method, setMethod] = useState('momo')
  const [momo, setMomo] = useState('')
  const [card, setCard] = useState('')
  const [status, setStatus] = useState(null)

  async function placeOrder(){
    setStatus('processing')
    if (method === 'momo' && !validateRequired(momo)) return setStatus('enter_momo')
    if (method === 'card' && !validateRequired(card)) return setStatus('enter_card')
    try{
      if (method === 'momo'){
        const res = await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ payment_method:'momo', momo_number: momo }), credentials:'include'})
        const j = await res.json()
        if (j.orderId) setStatus('success:'+j.orderId)
        else setStatus('error')
      } else {
        // card
        const res = await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ payment_method:'card', card_number: card }), credentials:'include'})
        const j = await res.json()
        if (j.stripeUrl) {
          window.location = j.stripeUrl
        } else if (j.orderId) setStatus('success:'+j.orderId)
        else setStatus('error')
      }
    }catch(e){ setStatus('error') }
  }

  const total = items ? items.reduce((s,i)=>s + i.price * i.qty,0).toFixed(2) : '0.00'

  return (
    <div>
      <Header />
      <main className="container">
        <div className="glass" style={{padding:20,marginTop:18}}>
          <h1>Checkout</h1>
          {error ? <div className="muted">Could not load cart</div> : !items ? <p>Loading...</p> : items.length === 0 ? <p className="muted">Your cart is empty</p> : (
            <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16}}>
              <div>
                {items.map(i=> (
                  <div key={i.id} className="card" style={{display:'flex',justifyContent:'space-between',padding:12}}>
                    <div>
                      <strong>{i.title}</strong>
                      <div className="muted">Qty: {i.qty}</div>
                    </div>
                    <div style={{fontWeight:700}}>GHS {(i.price * i.qty).toFixed(2)}</div>
                  </div>
                ))}
              </div>
              <aside className="summary">
                <h3>Order Summary</h3>
                <div className="row total"><div>Total</div><div>GHS {total}</div></div>
                <div style={{marginTop:12}}>
                  <div style={{marginBottom:8}}>
                    <label style={{display:'block',marginBottom:6}}><input type="radio" name="method" checked={method==='momo'} onChange={()=>setMethod('momo')} /> Mobile money</label>
                    {method==='momo' && (<div><input placeholder="Momo number" value={momo} onChange={e=>setMomo(e.target.value)} style={{padding:8,width:'100%',borderRadius:8,border:'1px solid rgba(0,0,0,0.06)'}} /></div>)}
                  </div>
                  <div style={{marginBottom:8}}>
                    <label style={{display:'block',marginBottom:6}}><input type="radio" name="method" checked={method==='card'} onChange={()=>setMethod('card')} /> Card</label>
                    {method==='card' && (<div><input placeholder="Card number (test)" value={card} onChange={e=>setCard(e.target.value)} style={{padding:8,width:'100%',borderRadius:8,border:'1px solid rgba(0,0,0,0.06)'}} /></div>)}
                  </div>
                  <div style={{marginTop:10}}>
                    <button className="cta" onClick={placeOrder} style={{width:'100%'}}>Place order</button>
                  </div>
                  {status && <div style={{marginTop:12}}>{status.startsWith('success:') ? (<div className="notice success">Order placed: {status.split(':')[1]}</div>) : status==='processing' ? <div className="muted">Processing...</div> : status==='enter_momo' ? <div style={{color:'crimson'}}>Enter Momo number</div> : status==='enter_card' ? <div style={{color:'crimson'}}>Enter card number</div> : <div style={{color:'crimson'}}>Payment failed</div> }</div>}
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
