const puppeteer = require('puppeteer');

(async ()=>{
  const base = 'https://modernpedagogues-2d8e4f4bb9bf.herokuapp.com';
  const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  page.on('dialog', async dialog => { console.log('Dialog:', dialog.message()); await dialog.accept(); });
  page.on('response', async resp => {
    try {
      const url = resp.url();
      if (url.includes('/api/cart/add') || url.includes('/api/cart')) {
        const headers = resp.headers();
        const body = await resp.text().catch(()=>null)
        console.log('Network response for', url, 'status', resp.status(), 'headers', JSON.stringify(headers).slice(0,400), 'body:', body)
      }
    } catch(e) {}
  })
  page.on('request', async req => {
    try {
      const url = req.url();
      if (url.includes('/api/cart/add') || url.includes('/api/cart')) {
        const headers = req.headers();
        console.log('Network request for', url, 'headers', JSON.stringify(headers).slice(0,400))
      }
    } catch(e) {}
  })
  try{
    console.log('Open E-Store...')
    await page.goto(base + '/estore', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('.product-grid, .product', { timeout: 10000 });

    console.log('Clicking first Add to cart...')
    // Click the first "Add to cart" / "Add" button we can find by text
    const clicked = await page.evaluate(() => {
      function clickMatching() {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        for (const b of buttons) {
          const t = (b.innerText || '').toLowerCase();
          if (t.includes('add to cart') || (t.includes('add') && t.includes('cart')) || t.trim() === 'add') {
            b.click(); return true;
          }
        }
        // fallback: click any button that contains 'Add to cart' as substring
        for (const b of buttons) if ((b.innerText||'').toLowerCase().includes('add to cart')) { b.click(); return true }
        return false
      }
      return clickMatching()
    })
    if (!clicked) {
      console.error('No add-to-cart buttons found')
      await browser.close();
      process.exit(2)
    }
    await new Promise(r => setTimeout(r, 600)); // wait for client-side handler

    // Ensure cart badge appears in header
    console.log('Waiting for cart badge...')
    const badge = await page.waitForSelector('.badge', { timeout: 5000 }).catch(()=>null)
    if (!badge) {
      console.error('Cart badge not visible after add')
      await browser.close();
      process.exit(3)
    }
    const badgeText = await page.evaluate(el=>el.innerText, badge)
    console.log('Cart badge text:', badgeText)

    // Read /api/cart directly from browser context to verify session-backed cart
    const apiCart = await page.evaluate(async ()=>{
      try { const r = await fetch('/api/cart', { credentials: 'include' }); return await r.json() } catch(e) { return { error: String(e) } }
    })
    console.log('API /api/cart returned (browser):', JSON.stringify(apiCart).slice(0,400))

    console.log('Navigate to /checkout (client checkout page)')
    await page.goto(base + '/checkout', { waitUntil: 'networkidle2' })
    console.log('Looking for checkout form on /checkout...')
    // Wait for checkout form (client-side) to appear — checkout.js will use localStorage fallback if session cart empty
    await page.waitForSelector('input[placeholder="Momo number"]', { timeout: 10000 })

    console.log('Filling momo number and placing order...')
    await page.waitForSelector('input[placeholder="Momo number"]', { timeout: 5000 })
    await page.type('input[placeholder="Momo number"]', '0240000000')
    // Click Place order
    await page.click('button.cta')
    // Wait for success notice or failure
      await new Promise(r => setTimeout(r, 1200))
    const success = await page.$('.notice.success')
    if (success) {
      const txt = await page.evaluate(el => el.innerText, success)
      console.log('Order success text:', txt)
      await browser.close();
      process.exit(0)
    } else {
      const errTxt = await page.evaluate(() => document.body.innerText.slice(0,800))
      console.error('No success confirmation. Page text sample:', errTxt)
      await browser.close();
      process.exit(4)
    }
  } catch (e) {
    console.error('Puppeteer smoke test failed', e)
    await browser.close();
    process.exit(1)
  }
})();
