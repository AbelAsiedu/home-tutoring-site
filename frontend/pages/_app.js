import '../styles/globals.css'
import Head from 'next/head'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link rel="stylesheet" href="/css/style.css" />
        <meta name="description" content="The Modern Pedagogues — professional home tutoring aligned to GES, Cambridge and international curricula." />
        <meta property="og:title" content="The Modern Pedagogues" />
        <meta property="og:description" content="Personalised home tutoring and curriculum resources for learners." />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}

