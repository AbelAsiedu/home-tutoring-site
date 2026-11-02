import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'

const whatsappLink = 'https://wa.me/233593660708?text=Hello%20TMP%2C%20I%20would%20like%20to%20request%20a%20tutor%20for%20my%20ward.'
const tutors = [
  ['Abel Asiedu', 'Mathematics', 'Primary, JHS and SHS support'],
  ['Christian Braun', 'Physics', 'SHS and international curricula'],
  ['Theophilus Banful', 'Chemistry', 'JHS, SHS and exam preparation'],
  ['Stephen Okwa', 'English', 'Language, comprehension and writing'],
  ['Aaron Neesmith', 'Biology', 'SHS science and revision planning'],
  ['Malvin Canva', 'Computer Science', 'Programming, ICT and digital skills']
]

export default function Tutors() {
  return <div>
    <Header />
    <main className="tutors-page">
      <section className="tutors-hero"><div className="container"><p className="section-kicker">Our tutors</p><h1>Qualified people. One coordinated standard.</h1><p>Every TMP tutor is a qualified, trained graduate educator. We operate as one coordinated team, working to the same standard on every assignment.</p><div className="hero-actions"><a href={whatsappLink} className="cta">Request a Tutor</a><Link href="/contact" className="btn ghost">Talk to admin</Link></div></div></section>
      <section className="container tutors-intro"><div><p className="section-kicker">Trust & safety</p><h2>Not a pool of part-timers called in per contract.</h2></div><div><p>Each tutor is assessed, onboarded and monitored before being placed with a ward. Parents always have a direct contact at TMP, not just the tutor.</p><p>We match subject knowledge, teaching style, curriculum experience and practical availability to the learner\'s needs.</p></div></section>
      <section className="tutor-roster"><div className="container"><p className="section-kicker">The team</p><h2>Specialists for different stages and subjects.</h2><div className="tutor-roster-grid">{tutors.map(([name, subject, detail], index) => <article key={name}><div className="tutor-number">0{index + 1}</div><img src="/images/tutor-placeholder.svg" alt={`${name}, TMP tutor`} /><div><h3>{name}</h3><strong>{subject}</strong><p>{detail}</p></div></article>)}</div></div></section>
      <section className="container tutor-standard"><p className="section-kicker">Every placement includes</p><div className="standard-grid"><article><strong>01</strong><h3>Assessment</h3><p>We review the tutor\'s subject knowledge, experience and fit before introduction.</p></article><article><strong>02</strong><h3>Onboarding</h3><p>Every educator joins one TMP way of working, communicating and reporting.</p></article><article><strong>03</strong><h3>Monitoring</h3><p>Progress, feedback and parent communication keep the assignment accountable.</p></article></div></section>
      <section className="tutors-cta"><div className="container"><p className="section-kicker">Find the right fit</p><h2>Tell us what your ward needs.</h2><p>We will help you find the right tutor and programme.</p><a href={whatsappLink} className="cta">Start on WhatsApp</a></div></section>
    </main>
    <Footer />
  </div>
}
