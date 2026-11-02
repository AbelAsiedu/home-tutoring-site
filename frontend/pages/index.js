
import Link from 'next/link'
import { useEffect, useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { getExpressUser } from '../lib/express-session-user'

export default function Home({ initialUser }) {
  const whatsappLink = 'https://wa.me/233593660708?text=Hello%20TMP%2C%20I%20would%20like%20to%20request%20a%20tutor%20for%20my%20ward.'
  const defaultSlides = ['/images/hero-illustration.svg', '/images/slide2.svg', '/images/tutor-placeholder.svg']
  const [slideImages, setSlideImages] = useState(defaultSlides)

  useEffect(() => {
    Promise.all([1, 2, 3].map(number => fetch(`/api/content/home_slide_${number}`, { cache: 'no-store' }).then(response => response.ok ? response.json() : null).catch(() => null)))
      .then(rows => {
        const configuredSlides = rows.map((row, index) => row?.value || defaultSlides[index])
        setSlideImages(configuredSlides)
      })
  }, [])

  const heroBackground = encodeURI(slideImages[0])

  return (
    <div>
      <Header initialUser={initialUser} />
      <main>
        <section className="tmp-hero" style={{backgroundImage: `linear-gradient(90deg, rgba(18,36,58,.97) 0%, rgba(18,36,58,.88) 46%, rgba(18,36,58,.42) 100%), url("${heroBackground}")`}}>
          <div className="tmp-hero-inner">
            <div className="tmp-hero-copy">
              <p className="eyebrow">Educational Consultancy · Curriculum & Assessment · Tutoring Programmes</p>
              <h1>Education keeps changing. So do we.</h1>
              <p className="hero-copy">We don't lock into one method because it's comfortable. The Modern Pedagogues is always reshaping how we teach, tailored to each ward, tested to make sure it actually works, and built with the future in mind, from Preschool through Senior High School, across Ghanaian, British, Pearson Edexcel, IB and Canadian curricula.</p>
              <div className="curriculum-badges">
                {['Ghana Education Service', 'Cambridge / British', 'Pearson Edexcel', 'IB', 'Canadian Curriculum'].map((badge) => <span key={badge}>{badge}</span>)}
              </div>
              <div className="hero-actions">
                <a href={whatsappLink} className="cta">Request a Tutor</a>
                <Link href="/curriculum" className="btn ghost">Explore Programmes</Link>
              </div>
            </div>
            <div className="tmp-hero-art hero-slideshow" aria-label="Learning programme highlights">
              <div className="hero-slideshow-inner">
                {slideImages.map((image, index) => <div className="slide" key={image + index}><img src={image} alt={`TMP learning programme ${index + 1}`} /></div>)}
              </div>
              <span className="hero-stamp">Empowering Lives,<br />Changing Destinies.</span>
            </div>
          </div>
        </section>

        <section className="tmp-proof-rail" aria-label="TMP learning support highlights">
          <div className="tmp-proof-inner">
            <div><strong>Preschool → SHS</strong><span>Support across every stage</span></div>
            <div><strong>Ghanaian + international</strong><span>Curricula that travel with your ward</span></div>
            <div><strong>Tracked progress</strong><span>Honest reporting, every term</span></div>
          </div>
        </section>

        <section className="tmp-visual-strip container" aria-label="TMP learning programmes">
          {slideImages.map((image, index) => <figure key={`visual-${image}-${index}`}><img src={image} alt={`TMP programme view ${index + 1}`} /><figcaption>{['Learning that adapts', 'Support across curricula', 'A team behind every ward'][index]}</figcaption></figure>)}
        </section>

        <section className="tmp-section tmp-mission container">
          <p className="section-kicker">Our mission</p>
          <h2>Built around the student, not a fixed syllabus.</h2>
          <p>The Modern Pedagogues was founded 2019 on the belief that education shouldn't stay frozen in the past. Every ward learns differently, so we build around the student, not a fixed syllabus delivered the same way to everyone. That means qualified tutors, a plan tailored to how each ward actually learns, tracked progress, and honest reporting, every term.</p>
        </section>

        <section className="tmp-section services-section">
          <div className="container">
            <p className="section-kicker">What we do</p>
            <h2>Support that moves with every learner.</h2>
            <div className="services-grid">
              <article><span>01</span><h3>Home Tuition</h3><p>One-on-one, in-home teaching across Preschool, Primary, JHS and SHS, built around each ward's pace, subjects and schedule.</p></article>
              <article><span>02</span><h3>Online & International Support</h3><p>Structured remote lessons for students on British, Pearson Edexcel, IB, Canadian and other foreign curricula, wherever they are based.</p></article>
              <article><span>03</span><h3>Final Lap Exam Prep</h3><p>Intensive group revision and mock examinations ahead of BECE and major assessments, with performance tracked mock by mock.</p></article>
              <article><span>04</span><h3>Pre-SHS Launchpad</h3><p>Structured preparation for students transitioning into Senior High School.</p></article>
              <article><span>05</span><h3>Curriculum & Assessment Consulting</h3><p>Curriculum design and assessment services for schools and institutions.</p></article>
              <article><span>06</span><h3>Tutor Training & Management</h3><p>Recruitment, training and ongoing management of a qualified tutor network.</p></article>
            </div>
            <div className="programme-row">
              {['Final Lap', 'Pre-SHS Launchpad', 'Home Tuition', 'Online Learning', 'Many more'].map((programme) => <span key={programme}>{programme}</span>)}
            </div>
          </div>
        </section>

        <section className="tmp-section tutors-section container">
          <div>
            <p className="section-kicker">Our tutors</p>
            <h2>One coordinated team, held to one standard.</h2>
          </div>
          <div className="tutors-copy">
            <p>Every TMP tutor is a qualified, trained graduate educator. We operate as one coordinated team, working to the same standard on every assignment — not a pool of part-timers called in per contract. Each tutor is assessed, onboarded and monitored before being placed with a ward.</p>
            <p className="admin-line"><strong>A direct line to admin:</strong> Parents always have a direct contact at TMP, not just the tutor.</p>
          </div>
        </section>

        <section className="tmp-cta">
          <div className="container">
            <p className="section-kicker">Start a conversation</p>
            <h2>Tell us what your ward needs next.</h2>
            <p>We will help you find the right programme, tutor and learning plan.</p>
            <div className="hero-actions"><a href={whatsappLink} className="cta">Request a Tutor</a><Link href="/contact" className="btn ghost">Get in touch</Link></div>
          </div>
        </section>
      </main>
      <Footer initialUser={initialUser} />
    </div>
  )
}

export async function getServerSideProps({ req }) {
  return { props: { initialUser: await getExpressUser(req) } }
}
