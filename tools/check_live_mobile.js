const puppeteer = require('puppeteer');
const fs = require('fs');

(async ()=>{
  const url = 'https://modernpedagogues-2d8e4f4bb9bf.herokuapp.com/';
  const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  // emulate a mobile viewport similar to iPhone 12
  await page.setViewport({width:390, height:844, deviceScaleFactor:3, isMobile:true, hasTouch:true});
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1');
  await page.goto(url, {waitUntil:'networkidle2', timeout: 30000});

  // Wait for header
  await page.waitForSelector('.site-header', {timeout:5000});
  // screenshot before
  await page.screenshot({path:'tools/mobile-before.png', fullPage:false});

  // Check if nav-toggle exists and click it
  const hasToggle = await page.$('.nav-toggle') !== null;
  let navOpened = false;
  if (hasToggle) {
    await page.tap('.nav-toggle');
    // small wait for animation
    await new Promise(r => setTimeout(r, 400));
    navOpened = await page.evaluate(()=>{
      const hdr = document.querySelector('.site-header');
      return hdr && hdr.classList.contains('nav-open');
    });
    await page.screenshot({path:'tools/mobile-after-toggle.png', fullPage:false});
  }

  // Check slideshow progression: look for .hero-slideshow and active dot change
  let slideshowWorked = false;
  const slideshowExists = await page.$('.hero-slideshow') !== null;
  if (slideshowExists) {
    // capture initial active dot index
    const initialIndex = await page.evaluate(()=>{
      const dots = document.querySelectorAll('.hero-slideshow .dot');
      for (let i=0;i<dots.length;i++) if (dots[i].classList.contains('active')) return i;
      return -1;
    });
    await new Promise(r => setTimeout(r, 5000)); // wait for one auto-advance interval
    const laterIndex = await page.evaluate(()=>{
      const dots = document.querySelectorAll('.hero-slideshow .dot');
      for (let i=0;i<dots.length;i++) if (dots[i].classList.contains('active')) return i;
      return -1;
    });
    slideshowWorked = (initialIndex !== -1 && laterIndex !== -1 && initialIndex !== laterIndex);
    await page.screenshot({path:'tools/mobile-slideshow.png', fullPage:false});
  }

  const result = { url, hasToggle, navOpened, slideshowExists, slideshowWorked };
  fs.writeFileSync('tools/check_live_mobile_result.json', JSON.stringify(result, null, 2));
  console.log('Result:', result);
  await browser.close();
})();
