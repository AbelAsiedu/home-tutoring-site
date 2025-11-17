// Simple slideshow auto-advance
document.addEventListener('DOMContentLoaded', function(){
  // Initialize hero slideshows (supports multiple on the page)
  document.querySelectorAll('.hero-slideshow').forEach(slideshow => {
    const slides = slideshow.querySelectorAll('.slide');
    if (!slides.length) return;
    let idx = 0;
    slides.forEach((s,i)=>{
      s.style.opacity = i===0 ? '1' : '0';
      s.style.transition = 'opacity 700ms ease, transform 220ms ease';
      s.style.position = 'absolute';
      s.style.top = 0; s.style.left = 0; s.style.width = '100%'; s.style.height = '100%';
      s.style.transform = 'translateX(0)';
    });

    // indicators
    const dots = document.createElement('div');
    dots.className = 'slide-dots';
    slides.forEach((_,i)=>{
      const b = document.createElement('button');
      b.className = 'dot' + (i===0 ? ' active' : '');
      b.setAttribute('aria-label', `Go to slide ${i+1}`);
      b.addEventListener('click', ()=>{
        goTo(i);
      });
      dots.appendChild(b);
    });
    slideshow.appendChild(dots);

    let timer;
    const startTimer = ()=> { clearInterval(timer); timer = setInterval(()=> nextSlide(), 4500); };
    const stopTimer = ()=> { clearInterval(timer); };

    function goTo(i){
      if (i === idx) return;
      slides[idx].style.opacity = '0';
      slides[idx].style.transform = 'translateX(0)';
      dots.children[idx].classList.remove('active');
      idx = i;
      slides[idx].style.opacity = '1';
      dots.children[idx].classList.add('active');
    }
    function nextSlide(){ goTo((idx+1) % slides.length); }
    function prevSlide(){ goTo((idx-1+slides.length) % slides.length); }

    startTimer();

    slideshow.addEventListener('mouseenter', ()=> stopTimer());
    slideshow.addEventListener('mouseleave', ()=> startTimer());

    // Touch / swipe support
    let startX = 0, curX = 0, isTouch = false;
    const THRESHOLD = 50; // px
    slideshow.addEventListener('touchstart', (e)=>{
      stopTimer();
      isTouch = true;
      startX = e.touches[0].clientX;
      curX = startX;
    }, {passive:true});
    slideshow.addEventListener('touchmove', (e)=>{
      if (!isTouch) return;
      curX = e.touches[0].clientX;
      const diff = curX - startX;
      // translate current slide for feedback
      slides[idx].style.transform = `translateX(${diff}px)`;
    }, {passive:true});
    slideshow.addEventListener('touchend', (e)=>{
      if (!isTouch) return;
      const diff = curX - startX;
      slides[idx].style.transform = '';
      if (Math.abs(diff) > THRESHOLD) {
        if (diff < 0) nextSlide(); else prevSlide();
      }
      isTouch = false;
      startTimer();
    });

    // Keyboard navigation when focused
    slideshow.tabIndex = 0;
    slideshow.addEventListener('keydown', (e)=>{
      if (e.key === 'ArrowLeft') { prevSlide(); e.preventDefault(); }
      if (e.key === 'ArrowRight') { nextSlide(); e.preventDefault(); }
    });
  });

  // Cookie consent
  if (!document.cookie.includes('cookie_consent')){
    const b = document.createElement('div');
    b.className = 'cookie-consent';
    b.style.position='fixed';b.style.bottom='12px';b.style.left='12px';b.style.right='12px';b.style.background='rgba(255,255,255,0.95)';b.style.padding='12px';b.style.borderRadius='8px';
    b.innerHTML = 'We use cookies to improve your experience. <button id="acceptCookies">Accept</button>';
    document.body.appendChild(b);
    document.getElementById('acceptCookies').addEventListener('click', ()=>{ document.cookie = 'cookie_consent=1;max-age=' + 60*60*24*365; b.remove(); });
  }

  // Mobile nav toggle for server-rendered header
  const navToggle = document.querySelector('.nav-toggle');
  if (navToggle) {
    navToggle.addEventListener('click', function(e){
      const header = document.querySelector('.site-header');
      if (!header) return;
      header.classList.toggle('nav-open');
    });
  }

  // FAQ accordion toggles
  document.querySelectorAll('.faq-item').forEach(item => {
    const btn = item.querySelector('.faq-question');
    if (!btn) return;
    btn.addEventListener('click', ()=>{
      const open = item.classList.toggle('open');
      // collapse siblings
      document.querySelectorAll('.faq-item').forEach(sib=>{
        if (sib!==item) sib.classList.remove('open');
      });
    });
  });

  // Server-rendered mini-cart close/cancel handlers
  const cartCloseServer = document.getElementById('cart-close-server');
  if (cartCloseServer) {
    cartCloseServer.addEventListener('click', function(e){
      const mc = this.closest('.mini-cart');
      if (mc) mc.style.display = 'none';
    });
  }
  const cartCancelServer = document.getElementById('cart-cancel-server');
  if (cartCancelServer) {
    cartCancelServer.addEventListener('click', function(e){
      const mc = this.closest('.mini-cart');
      if (mc) mc.style.display = 'none';
    });
  }

  // Animated show/hide helpers for server-rendered mini-cart
  function showMiniCart(mc){
    if (!mc) return;
    mc.style.display = 'block';
    requestAnimationFrame(()=> mc.classList.add('show'));
  }
  function hideMiniCart(mc){
    if (!mc) return;
    mc.classList.remove('show');
    const onEnd = function(){ mc.style.display = 'none'; mc.removeEventListener('transitionend', onEnd); };
    mc.addEventListener('transitionend', onEnd);
  }

  // Close server-rendered mini-cart on Escape
  function onServerKey(e){ if (e.key === 'Escape'){ const mc = document.querySelector('.mini-cart'); if (mc) hideMiniCart(mc); } }
  document.addEventListener('keydown', onServerKey);

  // Click-outside to close server mini-cart
  function onServerDown(e){
    const mc = document.querySelector('.mini-cart');
    if (!mc) return;
    if (!mc.contains(e.target) && !e.target.closest('a[href="/cart"]')) hideMiniCart(mc);
  }
  document.addEventListener('mousedown', onServerDown);

  // Show mini-cart initially with animation if it contains content
  const serverMC = document.querySelector('.mini-cart');
  if (serverMC) {
    // if it has any list items or not-empty state, show it
    if (serverMC.querySelector('ul') || serverMC.querySelector('.muted') === null) showMiniCart(serverMC);
  }

  // cleanup when navigating away (not strictly necessary in static script)
  window.addEventListener('unload', ()=>{
    document.removeEventListener('keydown', onServerKey);
    document.removeEventListener('mousedown', onServerDown);
  });
});
