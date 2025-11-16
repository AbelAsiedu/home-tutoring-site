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
      <section className="hero-slideshow" style={{height:220}}>
        <div className="hero-slideshow-inner" style={{position:'relative',height:'100%'}}>
          <div className="slide"><img loading="lazy" src="/images/hero-illustration.svg" alt="slide-1" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
          <div className="slide"><img loading="lazy" src="/images/slide2.svg" alt="slide-2" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
          <div className="slide"><img loading="lazy" src="/images/hero-illustration.svg" alt="slide-3" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
        </div>
      </section>
      <main className="container">
        <div className="glass" style={{padding:20,marginTop:18}}>
          <h1>About The Modern Pedagogues</h1>
          {error ? <div className="muted">Could not load about content</div> : <div className="muted" dangerouslySetInnerHTML={{__html: aboutHtml}} />}
        </div>

        <section className="lesson-plans glass" style={{marginTop:18}}>
          <h2>Lesson Plans</h2>
          <p className="muted">Structured lesson plans mapped to curricula, with weekly objectives, topics and suggested resources. Each plan includes learning outcomes and recommended supporting materials.</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,marginTop:12}}>
            <div className="plan-card">
              <h4>Primary</h4>
              <ul className="muted">
                <li>Weekly focus: Number sense, basic operations</li>
                <li>Objectives: Fluency with addition/subtraction, introduction to multiplication</li>
                <li>Resources: Workbooks, flashcards, practice worksheets</li>
              </ul>
            </div>
            <div className="plan-card">
              <h4>Junior High (JHS)</h4>
              <ul className="muted">
                <li>Weekly focus: Algebra foundations, reading comprehension</li>
                <li>Objectives: Solve simple equations, inferential reading</li>
                <li>Resources: Curriculum-aligned textbooks, past papers</li>
              </ul>
            </div>
            <div className="plan-card">
              <h4>Senior High (SHS)</h4>
              <ul className="muted">
                <li>Weekly focus: Exam techniques, advanced topics</li>
                <li>Objectives: Apply concepts to problem-solving, exam practice</li>
                <li>Resources: Revision guides, topic tests, recordings</li>
              </ul>
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
