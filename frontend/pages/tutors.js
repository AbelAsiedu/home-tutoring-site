import Header from '../components/Header'
import Footer from '../components/Footer'

export default function Tutors(){
  return (
    <div>
      <Header />
      <section className="hero-slideshow" style={{height:220}}>
        <div className="hero-slideshow-inner" style={{position:'relative',height:'100%'}}>
          <div className="slide"><img src="/images/slide2.svg" alt="slide-1" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
          <div className="slide"><img src="/images/hero-illustration.svg" alt="slide-2" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
          <div className="slide"><img src="/images/slide2.svg" alt="slide-3" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
        </div>
      </section>
      <main className="container">
        <section className="glass" style={{padding:18,marginTop:18}}>
          <h1>Our Tutors</h1>
          <p className="muted">All our tutors are vetted, experienced, and trained to deliver curriculum-aligned lessons.</p>
          <div className="product-grid" style={{marginTop:12}}>
            <div className="card glass" style={{textAlign:'center',padding:14}}>
              <img src="/images/tutor-placeholder.svg" alt="Tutor" style={{width:120,height:120,margin:'0 auto'}} />
              <h3>Abel Asiedu</h3>
              <div className="muted">Senior Tutor • Mathematics</div>
            </div>
            <div className="card glass" style={{textAlign:'center',padding:14}}>
              <img src="/images/tutor-placeholder.svg" alt="Tutor" style={{width:120,height:120,margin:'0 auto'}} />
              <h3>Christian Braun</h3>
              <div className="muted">Senior Tutor • Physics</div>
            </div>
            <div className="card glass" style={{textAlign:'center',padding:14}}>
              <img src="/images/tutor-placeholder.svg" alt="Tutor" style={{width:120,height:120,margin:'0 auto'}} />
              <h3>Theophilus Banful</h3>
              <div className="muted">Senior Tutor • Chemistry</div>
            </div>
            <div className="card glass" style={{textAlign:'center',padding:14}}>
              <img src="/images/tutor-placeholder.svg" alt="Tutor" style={{width:120,height:120,margin:'0 auto'}} />
              <h3>Stephen Okwa</h3>
              <div className="muted">Senior Tutor • English</div>
            </div>
            <div className="card glass" style={{textAlign:'center',padding:14}}>
              <img src="/images/tutor-placeholder.svg" alt="Tutor" style={{width:120,height:120,margin:'0 auto'}} />
              <h3>Aaron Neesmith</h3>
              <div className="muted">Senior Tutor • Biology</div>
            </div>
            <div className="card glass" style={{textAlign:'center',padding:14}}>
              <img src="/images/tutor-placeholder.svg" alt="Tutor" style={{width:120,height:120,margin:'0 auto'}} />
              <h3>Malvin Canva</h3>
              <div className="muted">Senior Tutor • Computer Science</div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
