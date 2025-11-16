import Header from '../components/Header'
import Footer from '../components/Footer'

export default function FAQ(){
  const faqs = [
    {q: 'What ages do you teach?', a: 'We teach learners from age 5 through high school and offer adult learning support.'},
    {q: 'Do you offer online lessons?', a: 'Yes — we offer both in-home and online lessons via video call.'},
    {q: 'How are tutors vetted?', a: 'All tutors provide references and are interviewed and observed before joining our network.'}
  ]

  return (
    <div>
      <Header />
      <main className="container">
        <section className="glass" style={{padding:18,marginTop:18}}>
          <h1>Frequently Asked Questions</h1>
          <div style={{marginTop:8}}>
            {faqs.map((f,i)=>(
              <div key={i} style={{marginTop:10}}>
                <strong>{f.q}</strong>
                <div className="muted">{f.a}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
