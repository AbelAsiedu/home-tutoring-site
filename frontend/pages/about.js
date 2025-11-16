import useSWR from 'swr'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { swrFetcher } from '../lib/api'

export default function About(){
  const { data, error } = useSWR('/api/content/about_text', swrFetcher)
  const aboutHtml = data && data.value ? data.value : `
    <p>The Modern Pedagogues was founded to bring quality home tutoring to families. Our tutors are experienced and vetted, and our lessons align with global curricula from GES to Cambridge and North American programs.</p>
    <h3>Our Mission</h3>
    <p>To make high-quality, curriculum-aligned tutoring accessible and affordable for learners at every level.</p>
    <h3>Our Approach</h3>
    <ul>
      <li>One-to-one and small group tutoring</li>
      <li>Personalised learning plans</li>
      <li>Regular progress reporting</li>
    </ul>
  `

  return (
    <div>
      <Header />
      <main className="container">
        <div className="glass" style={{padding:20,marginTop:18}}>
          <h1>About The Modern Pedagogues</h1>
          {error ? <div className="muted">Could not load about content</div> : <div className="muted" dangerouslySetInnerHTML={{__html: aboutHtml}} />}
        </div>

        <section style={{marginTop:18}} className="glass">
          <h2>Meet Our Tutors</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
            <div style={{padding:12,textAlign:'center'}}>
              <img src="/images/tutor-placeholder.svg" alt="Tutor" style={{width:140,height:140}} />
              <h4>Jane Doe</h4>
              <div className="muted">Math • 6 years experience</div>
            </div>
            <div style={{padding:12,textAlign:'center'}}>
              <img src="/images/tutor-placeholder.svg" alt="Tutor" style={{width:140,height:140}} />
              <h4>Kwame Mensah</h4>
              <div className="muted">English • 8 years experience</div>
            </div>
            <div style={{padding:12,textAlign:'center'}}>
              <img src="/images/tutor-placeholder.svg" alt="Tutor" style={{width:140,height:140}} />
              <h4>Amelia Smith</h4>
              <div className="muted">Science • 5 years experience</div>
            </div>
          </div>
        </section>

        <section style={{marginTop:18}} className="glass">
          <h2>Testimonials</h2>
          <div>
            <blockquote className="muted">“The Modern Pedagogues helped my child improve grades from C to A in six months — personalised and patient tutors.” — Parent, Accra</blockquote>
            <blockquote className="muted">“Excellent materials and clear progress reports.” — Student, Kumasi</blockquote>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  )
}
