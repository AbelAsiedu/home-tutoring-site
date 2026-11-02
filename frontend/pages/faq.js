import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'

const faqs = [
  ['What ages do you teach?', 'We support learners from Preschool through Senior High School, with programmes shaped around their stage, subjects and goals.'],
  ['Which curricula do you support?', 'We support Ghana Education Service, Cambridge / British, Pearson Edexcel, IB, Canadian and other international curricula.'],
  ['Do you offer online lessons?', 'Yes. We provide structured remote lessons for learners wherever they are based, as well as in-home tuition where available.'],
  ['How are tutors vetted?', 'Every TMP tutor is a qualified, trained graduate educator. Tutors are assessed, onboarded and monitored before being placed with a ward.'],
  ['How do you track progress?', 'We build a plan around the learner, track progress throughout the term and provide honest reporting to parents.'],
  ['Can parents contact TMP directly?', 'Yes. Parents always have a direct contact at TMP, not only the tutor assigned to the ward.'],
  ['Do you offer exam preparation?', 'Yes. Final Lap provides intensive group revision and mock examinations ahead of BECE and major assessments.'],
  ['How do I request a tutor?', 'Use the Request a Tutor button to start a WhatsApp conversation, or send us a message through the contact page.']
]

export default function FAQ() {
  return <div>
    <Header />
    <main className="faq-page">
      <section className="faq-hero"><div className="container"><p className="section-kicker">Questions, answered</p><h1>Clear information for the next decision.</h1><p>Here are the answers parents and learners ask us most often. If your question is not here, we are one message away.</p><Link href="/contact" className="cta">Ask TMP directly</Link></div></section>
      <section className="container faq-content"><div><p className="section-kicker">FAQ</p><h2>What families want to know.</h2></div><div className="faq-list">{faqs.map(([question, answer], index) => <details key={question} open={index === 0}><summary><span>0{index + 1}</span>{question}</summary><p>{answer}</p></details>)}</div></section>
      <section className="faq-cta"><div className="container"><p className="section-kicker">Still deciding?</p><h2>We can help you choose the right next step.</h2><Link href="/contact" className="cta">Contact TMP</Link></div></section>
    </main>
    <Footer />
  </div>
}
