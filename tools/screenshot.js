const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')

async function run(){
  const outDir = path.join(__dirname, '..', 'screenshots')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

  const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']})
  const page = await browser.newPage()
  await page.setViewport({width:1280,height:900})

  const targets = [
    { url: 'http://localhost:3001/', name: 'home' },
    { url: 'http://localhost:3001/curriculum', name: 'curriculum' },
    { url: 'http://localhost:3001/cart', name: 'cart' },
    { url: 'http://localhost:3001/apply', name: 'apply' },
    { url: 'http://localhost:3000/admin/login', name: 'admin-login' }
  ]

  for (const t of targets){
    try{
      console.log('Opening', t.url)
      const res = await page.goto(t.url, { waitUntil: 'networkidle2', timeout: 20000 })
      // wait a moment for UI animations
      await page.waitForTimeout(800)
      const file = path.join(outDir, `${t.name}.png`)
      await page.screenshot({ path: file, fullPage: true })
      console.log('Saved', file, 'status', res && res.status())
    }catch(e){
      console.error('Failed to capture', t.url, e.message)
    }
  }

  await browser.close()
}

run().catch(e=>{ console.error(e); process.exit(1) })
