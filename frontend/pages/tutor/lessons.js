import LmsPortal from '../../components/LmsPortal'

export async function getServerSideProps({ req }) {
  const role = (typeof req.getUserRole === 'function' && req.getUserRole()) || req.session?.user?.role
  if (!['tutor','admin'].includes(role)) return { redirect: { destination: '/login?next=/tutor/lessons', permanent: false } }
  return { props: {} }
}

// Legacy tutor route now opens the fully functional LMS workspace.
export default function TutorLessons(){ return <LmsPortal mode="tutor" /> }
