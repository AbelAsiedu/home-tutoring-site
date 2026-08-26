import LmsPortal from '../components/LmsPortal'

export async function getServerSideProps({ req }) {
  const user = (typeof req.getUser === 'function' && req.getUser()) || req.session?.user
  if (!user) return { redirect: { destination: '/login?next=/parent-lms', permanent: false } }
  return { props: {} }
}

export default function ParentLms(){ return <LmsPortal mode="parent" /> }
