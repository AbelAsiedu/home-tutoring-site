import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'

export default function About() {
  return <div>
    <Header />
    <main className="about-page">
      <section className="about-hero"><div className="container"><p className="section-kicker">About TMP</p><h1>Education should keep moving forward.</h1><p>The Modern Pedagogues was founded in 2019 on the belief that education should not stay frozen in the past.</p><div className="hero-actions"><Link href="/curriculum" className="cta">Explore our approach</Link><Link href="/contact" className="btn ghost">Get in touch</Link></div></div></section>
      <section className="container about-intro"><div><p className="section-kicker">Why we exist</p><h2>Build around the student, not a fixed syllabus.</h2></div><div><p>Every ward learns differently, so we build around the student, not a fixed syllabus delivered the same way to everyone. That means qualified tutors, a plan tailored to how each ward actually learns, tracked progress, and honest reporting, every term.</p><p>We work across Preschool, Primary, JHS and SHS, across Ghanaian, British, Pearson Edexcel, IB and Canadian curricula.</p></div></section>
      <section className="about-principles"><div className="container"><p className="section-kicker">Our principles</p><h2>Practical, personal, accountable.</h2><div className="principle-grid"><article><strong>01</strong><h3>Personalised learning</h3><p>Plans respond to how each ward learns, what they need now and where they want to go next.</p></article><article><strong>02</strong><h3>Qualified educators</h3><p>Every TMP tutor is assessed, trained and supported as part of one coordinated team.</p></article><article><strong>03</strong><h3>Honest progress</h3><p>Parents receive tracked progress and clear reporting rather than vague promises.</p></article></div></div></section>
      <section className="container about-story"><div><p className="section-kicker">From lesson to long-term confidence</p><h2>Modern pedagogy, grounded in real family life.</h2></div><p>Good tutoring fits around school, home, exams, confidence and the realities of a learner\'s schedule. Our work combines curriculum knowledge with the patience, structure and communication that help a ward make progress that lasts.</p></section>
      <section className="about-cta"><div className="container"><p className="section-kicker">Work with TMP</p><h2>Let\'s make the next stage clearer.</h2><p>Tell us about your ward, school and goals.</p><Link href="/contact" className="cta">Start a conversation</Link></div></section>
    </main>
    <Footer />
  </div>
}
