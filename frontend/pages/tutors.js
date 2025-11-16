import Header from '../components/Header'
import Footer from '../components/Footer'

export default function Tutors(){
  return (
    <div>
      <Header />
      <main className="container">
        <section className="glass" style={{padding:18,marginTop:18}}>
          <h1>Our Tutors</h1>
          <p className="muted">All our tutors are vetted, experienced, and trained to deliver curriculum-aligned lessons.</p>
          <div className="product-grid" style={{marginTop:12}}>
            <div className="card glass" style={{textAlign:'center',padding:14}}>
              <img src="/images/tutor-placeholder.svg" alt="Tutor" style={{width:120,height:120,margin:'0 auto'}} />
              <h3>Jane Doe</h3>
              <div className="muted">Mathematics • 6 years</div>
            </div>
            <div className="card glass" style={{textAlign:'center',padding:14}}>
              <img src="/images/tutor-placeholder.svg" alt="Tutor" style={{width:120,height:120,margin:'0 auto'}} />
              <h3>Kwame Mensah</h3>
              <div className="muted">English • 8 years</div>
            </div>
            <div className="card glass" style={{textAlign:'center',padding:14}}>
              <img src="/images/tutor-placeholder.svg" alt="Tutor" style={{width:120,height:120,margin:'0 auto'}} />
              <h3>Amelia Smith</h3>
              <div className="muted">Science • 5 years</div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
