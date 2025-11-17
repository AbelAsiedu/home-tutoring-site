
import useSWR from 'swr'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { swrFetcher } from '../lib/api'

export default function Home() {
  const { data: products, error } = useSWR('/api/products', swrFetcher)

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
      <section className="hero-slideshow">
        <div className="hero-slideshow-inner">
          <div className="slide"><img src="/images/slide2.svg" alt="slide-1"/></div>
          <div className="slide"><img src="/images/slide2.svg" alt="slide-2"/></div>
          <div className="slide"><img src="/images/slide2.svg" alt="slide-3"/></div>
        </div>
      </section>

      <main className="container">
        <section className="hero">
          <div className="hero-left">
            <h1>Personalised tutoring that builds confident learners</h1>
            <p className="lead">One-to-one lessons from vetted tutors, curriculum-aligned resources and flexible scheduling — for Primary, JHS, SHS and international programmes.</p>
            <div style={{display:'flex',gap:12,marginTop:16,flexWrap:'wrap'}}>
              <Link href="/curriculum" className="cta">Explore Curriculum</Link>
              <Link href="/apply" className="btn">Become a Tutor</Link>
            </div>
            <div className="trust-logos" style={{marginTop:18,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
              <div className="card small muted">Trusted by schools</div>
              <div className="card small muted">1000+ Lessons Delivered</div>
              <div className="card small muted">Verified Tutors</div>
            </div>
          </div>

          <div className="hero-right glass">
            <div className="booking-card">
              <h3>Book a free trial</h3>
              <p className="muted">Enter details and we'll match a tutor for a 30-minute trial session.</p>
              <form onSubmit={async (e)=>{e.preventDefault();
                const fd = new FormData(e.target);
                await fetch('/contact',{method:'POST',body:fd});
                alert('Thanks — we will be in touch.');
              }}>
                <input name="name" placeholder="Full name" required />
                <input name="phone" placeholder="Phone or WhatsApp" required />
                <select name="level">
                  <option>Primary</option>
                  <option>JHS</option>
                  <option>SHS</option>
                  <option>IGCSE / A-Levels</option>
                </select>
                <button className="btn" type="submit">Request trial</button>
              </form>
              <div className="muted" style={{fontSize:12,marginTop:8}}>Or call/WhatsApp <strong>+233 24 000 0000</strong></div>
            </div>
          </div>
        </section>

        <section className="how-it-works" style={{marginTop:28}}>
          <h2>How it works</h2>
          <div className="steps-grid">
            <div className="step card glass"><strong>1. Request a trial</strong><p className="muted">Tell us your goals and availability — we'll match a tutor.</p></div>
            <div className="step card glass"><strong>2. Meet your tutor</strong><p className="muted">Start with a free 30-minute lesson to see the fit.</p></div>
            <div className="step card glass"><strong>3. Track progress</strong><p className="muted">Get reports, homework and recommendations after each lesson.</p></div>
          </div>
        </section>

        <section className="platform" style={{marginTop:28}}>
          <h2>Platform & technology</h2>
          <div className="platform-grid">
            <div className="platform-card card glass"><h4>Live lessons</h4><p className="muted">Video lessons, screen sharing and interactive whiteboard.</p></div>
            <div className="platform-card card glass"><h4>Recordings & resources</h4><p className="muted">Lesson recordings and a library of worksheets.</p></div>
            <div className="platform-card card glass"><h4>Parental dashboard</h4><p className="muted">View progress, upcoming lessons and billing.</p></div>
          </div>
        </section>

        <section className="assessments" style={{marginTop:28}}>
          <h2>Assessments & reporting</h2>
          <p className="muted">Regular assessments and personalised learning plans to monitor progress.</p>
        </section>

        <section className="safeguarding" style={{marginTop:28}}>
          <h2>Safeguarding & quality</h2>
          <p className="muted">All tutors are vetted and background-checked; quality assurance is ongoing.</p>
        </section>

        <section className="pricing" style={{marginTop:28}}>
          <h2>Plans & pricing</h2>
          <div className="pricing-grid">
            <div className="plan card glass"><h3>Starter</h3><div className="muted">Single lessons</div><div className="price">GHS 65 / lesson</div><a href="/contact" className="btn">Get started</a></div>
            <div className="plan card glass"><h3>Regular</h3><div className="muted">Weekly lessons</div><div className="price">GHS 150 / lesson</div><a href="/contact" className="btn">Sign up</a></div>
            <div className="plan card glass"><h3>Premium</h3><div className="muted">Dedicated tutor & reports</div><div className="price">GHS 200 / lesson</div><a href="/contact" className="btn">Contact us</a></div>
          </div>
        </section>
        <section className="approach" style={{marginTop:32}}>
          <h2>Our approach to learning</h2>
          <div className="approach-grid">
            <div className="card glass"><h4>Personalised learning</h4><p className="muted">Lessons tailored to each learner's goals and style.</p></div>
            <div className="card glass"><h4>Evidence-based</h4><p className="muted">Formative assessments guide instruction.</p></div>
            <div className="card glass"><h4>Curriculum-aligned</h4><p className="muted">Mapped to national and international syllabuses.</p></div>
          </div>
        </section>

        <section className="subjects" style={{marginTop:28}}>
          <h2>Subjects we teach</h2>
          <div className="subjects-grid">
            <div className="card glass"><strong>Mathematics</strong><div className="muted">Primary → A-Level</div></div>
            <div className="card glass"><strong>English</strong><div className="muted">Comprehension & literature</div></div>
            <div className="card glass"><strong>Science</strong><div className="muted">Physics, Chemistry & Biology</div></div>
            <div className="card glass"><strong>Computer Science</strong><div className="muted">Programming & ICT</div></div>
            <div className="card glass"><strong>Accounting</strong><div className="muted">Exam-focused prep</div></div>
            <div className="card glass"><strong>Languages</strong><div className="muted">French & more</div></div>
          </div>
        </section>

        <section className="trust" style={{marginTop:28}}>
          <h2>Safety & quality</h2>
          <p className="muted">Background checks, safeguarding and ongoing tutor training are core to our offering.</p>
        </section>

        <section className="faq" style={{marginTop:28}}>
          <h2>Frequently asked questions</h2>
          <div className="faq-list">
            <div className="faq-item card glass">
              <button className="faq-question">How do trial lessons work?</button>
              <div className="faq-answer muted">Trial lessons are 30 minutes to assess fit; often complimentary with sign-up.</div>
            </div>
            <div className="faq-item card glass">
              <button className="faq-question">Can I change tutors?</button>
              <div className="faq-answer muted">Yes. We will rematch you if needed.</div>
            </div>
            <div className="faq-item card glass">
              <button className="faq-question">Are lessons recorded?</button>
              <div className="faq-answer muted">Yes — recordings and materials are available in the dashboard.</div>
            </div>
          </div>
        </section>

        <section className="cta-banner glass" style={{marginTop:28,padding:22,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <h3>Ready to start?</h3>
            <div className="muted">Book a free trial and we'll match a tutor to your goals.</div>
          </div>
          <div style={{display:'flex',gap:10}}>
            <a href="/apply" className="btn">Become a tutor</a>
            <a href="/contact" className="cta">Request a free trial</a>
          </div>
        </section>

        {/* Shop & Resources section removed from landing page per request */}
      </main>
      <Footer />
    </div>
  )
}
