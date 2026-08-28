// Hero slideshow controller.
// Managed/admin banners always win. When the site is using its built-in fallback
// slides, fetch relevant, freely licensed images from Wikimedia Commons and
// hotlink the returned image URLs. Wikimedia supports anonymous CORS with origin=*.
(function() {
  const WIKI_API = 'https://commons.wikimedia.org/w/api.php';
  const IMAGE_QUERIES = [
    'one to one tutoring education classroom',
    'students learning classroom books',
    'online learning student laptop education'
  ];

  function initSlideshow(slideshow, idx) {
    const slides = Array.from(slideshow.querySelectorAll('.slide'));
    if (slides.length < 2) return;

    let currentIdx = 0;
    slides.forEach((slide, i) => {
      slide.style.display = i === 0 ? 'block' : 'none';
      slide.style.opacity = i === 0 ? '1' : '0';
      slide.style.transition = 'opacity 700ms ease';
      slide.style.position = 'absolute';
      slide.style.inset = '0';
    });

    const inner = slideshow.querySelector('.hero-slideshow-inner');
    if (inner) {
      inner.style.position = 'relative';
      inner.style.overflow = 'hidden';
    }

    setInterval(() => {
      if (!slides[currentIdx]) return;
      slides[currentIdx].style.opacity = '0';
      setTimeout(() => { slides[currentIdx].style.display = 'none'; }, 700);
      currentIdx = (currentIdx + 1) % slides.length;
      slides[currentIdx].style.display = 'block';
      requestAnimationFrame(() => { slides[currentIdx].style.opacity = '1'; });
    }, 5000);
  }

  async function searchCommons(query) {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: query,
      gsrnamespace: '6',
      gsrlimit: '8',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: '1800',
      format: 'json',
      origin: '*'
    });
    const response = await fetch(`${WIKI_API}?${params.toString()}`, { credentials: 'omit' });
    if (!response.ok) throw new Error(`Wikimedia search failed: ${response.status}`);
    const data = await response.json();
    return Object.values(data?.query?.pages || {})
      .map(page => {
        const info = page.imageinfo?.[0];
        const meta = info?.extmetadata || {};
        return {
          url: info?.thumburl || info?.url,
          title: page.title || 'Educational image',
          artist: meta.Artist?.value || meta.Credit?.value || 'Wikimedia Commons',
          license: meta.LicenseShortName?.value || '',
          source: meta.ImageDescription?.source || info?.descriptionurl || 'https://commons.wikimedia.org/'
        };
      })
      .filter(item => /^https?:\/\//i.test(item.url || ''));
  }

  function addAttribution(slide, image) {
    const old = slide.querySelector('.web-image-credit');
    if (old) old.remove();
    const credit = document.createElement('a');
    credit.className = 'web-image-credit';
    credit.href = image.source;
    credit.target = '_blank';
    credit.rel = 'noopener noreferrer';
    credit.textContent = `Image: ${image.artist}${image.license ? ` · ${image.license}` : ''}`;
    credit.style.cssText = 'position:absolute;right:10px;bottom:8px;z-index:5;padding:4px 7px;border-radius:6px;background:rgba(0,0,0,.58);color:#fff;font-size:10px;text-decoration:none;line-height:1.2;max-width:75%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    slide.appendChild(credit);
  }

  async function populateFallbackImages(slideshow) {
    // Admin-managed banners are intentionally untouched.
    if (slideshow.classList.contains('managed-hero-banners')) return;

    const images = [];
    for (const query of IMAGE_QUERIES) {
      try {
        const found = await searchCommons(query);
        const usable = found.find(image => image.url && !images.some(existing => existing.url === image.url));
        if (usable) images.push(usable);
      } catch (error) {
        console.warn('Web hero image lookup failed:', error.message);
      }
    }

    if (images.length < 2) return;
    const slides = Array.from(slideshow.querySelectorAll('.slide'));
    images.slice(0, slides.length).forEach((image, i) => {
      const slide = slides[i];
      const img = slide.querySelector('img') || document.createElement('img');
      img.src = image.url;
      img.alt = image.title.replace(/^File:/, '');
      img.loading = i === 0 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      slide.appendChild(img);
      addAttribution(slide, image);
    });
  }

  function init() {
    document.querySelectorAll('.hero-slideshow').forEach((slideshow, idx) => {
      initSlideshow(slideshow, idx);
      populateFallbackImages(slideshow);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
