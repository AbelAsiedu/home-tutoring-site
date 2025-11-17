import Header from '../components/Header'
import Footer from '../components/Footer'

export default function Curriculum(){
  return (
    <div>
      <Header />
      <section className="hero-slideshow" style={{height:220}}>
        <div className="hero-slideshow-inner" style={{position:'relative',height:'100%'}}>
          <div className="slide"><img loading="lazy" src="/images/slide2.svg" alt="slide-1" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
          <div className="slide"><img loading="lazy" src="/images/hero-illustration.svg" alt="slide-2" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
          <div className="slide"><img loading="lazy" src="/images/slide2.svg" alt="slide-3" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
        </div>
      </section>
      <main className="container">
        <div className="glass" style={{padding:20,marginTop:18}}>
          <h1>Curriculum & Resources</h1>
          <p className="muted">This page now focuses on curricula and resources. Course books have been removed from this page; please visit the E-Store to browse and purchase books.</p>
        </div>

        <section style={{marginTop:18}}>
          <div className="glass">
            <p className="muted">If you need specific course books, go to <a href="/estore">E-Store</a> or contact us.</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
