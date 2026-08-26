import LmsPortal from '../components/LmsPortal'

export async function getServerSideProps({ req }) {
  const role = (typeof req.getUserRole === 'function' && req.getUserRole()) || req.session?.user?.role
  if (!['tutor','admin'].includes(role)) return { redirect: { destination: '/login?next=/tutor-lms', permanent: false } }
  return { props: {} }
}

export default function TutorLms(){ return <LmsPortal mode="tutor" /> }
