import LmsPortal from '../components/LmsPortal'

export async function getServerSideProps({ req }) {
  const role = (typeof req.getUserRole === 'function' && req.getUserRole()) || req.session?.user?.role
  if (role !== 'student') return { redirect: { destination: '/login?next=/student-lms', permanent: false } }
  return { props: {} }
}

export default function StudentLms(){ return <LmsPortal mode="student" /> }
