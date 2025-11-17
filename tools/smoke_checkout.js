(async ()=>{
  const base = 'https://modernpedagogues-2d8e4f4bb9bf.herokuapp.com';
  function toUrlEncoded(obj){ return Object.keys(obj).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(obj[k]||'')).join('&') }
  try{
    console.log('1) Logging in as seeded demo user...')
    const loginBody = toUrlEncoded({ email: 'student@example.com', password: 'password' })
    const loginRes = await fetch(base + '/login', { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: loginBody, redirect: 'manual' })
    const setCookie = loginRes.headers.get('set-cookie') || ''
    const cookie = setCookie.split(';').shift()
    if (!cookie) {
      console.error('No session cookie received from login. Response status:', loginRes.status)
      process.exit(2)
    }
    console.log(' -> Received cookie:', cookie)

    console.log('2) Fetching products...')
    const prodRes = await fetch(base + '/api/products', { headers: { 'Cookie': cookie } })
    const products = await prodRes.json()
    if (!products || products.length === 0) { console.error('No products available to add to cart'); process.exit(3) }
    const pid = products[0].id
    console.log(' -> Using product id:', pid)

    console.log('3) Adding product to cart...')
    const addBody = toUrlEncoded({ id: pid, quantity: 1 })
    const addRes = await fetch(base + '/api/cart/add', { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded', 'Cookie': cookie}, body: addBody })
    const addJson = await addRes.json()
    console.log(' -> add response:', addJson)

    console.log('4) Reading /api/cart...')
    const cartRes = await fetch(base + '/api/cart', { headers: { 'Cookie': cookie } })
    const items = await cartRes.json()
    console.log(' -> cart items:', items)
    if (!items || items.length === 0) { console.error('Cart is empty after add'); process.exit(4) }

    console.log('5) Attempting checkout (momo)...')
    const checkoutRes = await fetch(base + '/api/checkout', { method: 'POST', headers: {'Content-Type':'application/json', 'Cookie': cookie}, body: JSON.stringify({ payment_method: 'momo', momo_number: '0240000000' }) })
    const checkoutJson = await checkoutRes.json()
    console.log(' -> checkout response:', checkoutJson)
    if (checkoutJson && (checkoutJson.orderId || checkoutJson.stripeUrl)) {
      console.log('Smoke test succeeded: order created or stripe url returned')
      process.exit(0)
    } else {
      console.error('Checkout did not return expected response', checkoutJson)
      process.exit(5)
    }
  } catch (e) {
    console.error('Smoke test failed with error', e)
    process.exit(1)
  }
})()
