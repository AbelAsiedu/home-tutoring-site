// Slideshow controller - completely isolated
(function() {
  console.log('slideshow.js: loaded');
  
  function init() {
    console.log('slideshow.js: init() called');
    
    const slideshows = document.querySelectorAll('.hero-slideshow');
    console.log('slideshow.js: found ' + slideshows.length + ' slideshows');
    
    slideshows.forEach((slideshow, idx) => {
      console.log('slideshow.js: processing slideshow ' + idx);
      
      const slides = slideshow.querySelectorAll('.slide');
      console.log('slideshow.js: found ' + slides.length + ' slides');
      
      if (slides.length < 2) {
        console.log('slideshow.js: skipping - need at least 2 slides');
        return;
      }
      
      let currentIdx = 0;
      
      // Set initial styles
      slides.forEach((slide, i) => {
        slide.style.display = i === 0 ? 'block' : 'none';
      });
      
      // Rotate every 4 seconds
      setInterval(() => {
        slides[currentIdx].style.display = 'none';
        currentIdx = (currentIdx + 1) % slides.length;
        slides[currentIdx].style.display = 'block';
        console.log('slideshow.js: switched to slide ' + currentIdx);
      }, 4000);
      
      console.log('slideshow.js: slideshow ' + idx + ' initialized');
    });
  }
  
  // Try to init when document is ready
  if (document.readyState === 'loading') {
    console.log('slideshow.js: waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', init);
  } else {
    console.log('slideshow.js: DOM already ready, calling init');
    init();
  }
})();
