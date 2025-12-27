import '../styles/globals.css'
import Head from 'next/head'
import Script from 'next/script'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link rel="stylesheet" href="/css/style.css" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          /* Critical header CSS to reduce layout shift */
          .nav-inner{display:flex;align-items:center;justify-content:space-between;padding:12px 20px}
          .nav-links{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
          .nav-links a{padding:6px 8px}
          .nav-toggle{display:none}
          .brand .logo{width:42px;height:42px}
          .nav-actions{display:flex;gap:8px;align-items:center}
          .nav-actions .btn{padding:8px 10px;border-radius:8px}
          @media(max-width:900px){.nav-links{display:none}.nav-toggle{display:inline-flex}}
        `}</style>
        <meta name="description" content="The Modern Pedagogues — professional home tutoring aligned to GES, Cambridge and international curricula." />
        <meta property="og:title" content="The Modern Pedagogues" />
        <meta property="og:description" content="Personalised home tutoring and curriculum resources for learners." />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <Script src="/js/main.js" strategy="afterInteractive" />
      <Component {...pageProps} />
    </>
  )
}

