import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'

const whatsappLink = 'https://wa.me/233593660708?text=Hello%20TMP%2C%20I%20would%20like%20help%20choosing%20a%20curriculum%20for%20my%20ward.'

const pathways = [
  ['Ghana Education Service', 'Local foundation', 'Preschool, Primary, JHS and SHS support aligned to Ghanaian classroom expectations, schoolwork and national assessments.'],
  ['Cambridge / British', 'International pathway', 'Structured support across Cambridge Primary, IGCSE and A-Level subjects, with careful attention to syllabus objectives and exam technique.'],
  ['Pearson Edexcel', 'International pathway', 'Targeted help for Pearson Edexcel International GCSE and A-Level courses, including content mastery, practice and revision planning.'],
  ['IB', 'Inquiry-led learning', 'Support for IB learners through concept understanding, research, organisation and assessment preparation across PYP, MYP and DP contexts.'],
  ['Canadian Curriculum', 'North American pathway', 'Flexible support for Canadian and other North American programmes, adapted to the learner\'s school, province and current goals.']
]

export default function Curriculum() {
  return <div>
    <Header />
    <main className="curriculum-page">
      <section className="curriculum-hero">
        <div className="container">
          <p className="section-kicker">Curriculum & Assessment</p>
          <h1>One learner. The right learning route.</h1>
          <p>From Preschool through Senior High School, TMP helps families navigate Ghanaian and international curricula with teaching that responds to the learner, not just the label on the syllabus.</p>
          <div className="hero-actions"><a href={whatsappLink} className="cta">Talk to a curriculum adviser</a><Link href="/contact" className="btn ghost">Ask a question</Link></div>
        </div>
      </section>

      <section className="container curriculum-intro">
        <div><p className="section-kicker">A considered fit</p><h2>Curriculum alignment is where good planning starts.</h2></div>
        <p>We look at the ward\'s current school, subjects, pace, assessment calendar and next goal before recommending a plan. That can mean regular home tuition, structured online support, intensive exam preparation or a combination that changes as the learner grows.</p>
      </section>

      <section className="curriculum-pathways">
        <div className="container"><p className="section-kicker">Our pathways</p><h2>Support across the systems families use.</h2><div className="pathway-grid">{pathways.map(([title, label, body], index) => <article key={title}><span>0{index + 1}</span><div className="pathway-label">{label}</div><h3>{title}</h3><p>{body}</p></article>)}</div></div>
      </section>

      <section className="container curriculum-method">
        <p className="section-kicker">How we support progress</p><h2>More than syllabus coverage.</h2>
        <div className="method-grid"><article><strong>01</strong><h3>Map the starting point</h3><p>We identify what the learner understands, where confidence drops and which priorities matter next.</p></article><article><strong>02</strong><h3>Build the plan</h3><p>Lessons, resources and practice are shaped around the curriculum and the learner\'s real schedule.</p></article><article><strong>03</strong><h3>Track and report</h3><p>Progress is reviewed throughout the term, with honest reporting and practical next steps for parents.</p></article></div>
      </section>

      <section className="curriculum-cta"><div className="container"><p className="section-kicker">Need a clear next step?</p><h2>Tell us the curriculum, year group and goal.</h2><p>We will help you find the right programme for your ward.</p><a href={whatsappLink} className="cta">Request guidance on WhatsApp</a></div></section>
    </main>
    <Footer />
  </div>
}
