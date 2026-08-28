import LmsPortal from '../components/LmsPortal'

export async function getServerSideProps({ req }) {
  const role = (typeof req.getUserRole === 'function' && req.getUserRole()) || req.session?.user?.role
  if (!['parent'].includes(role)) return { redirect: { destination: '/login?next=/parent-lms', permanent: false } }
  return { props: {} }
}

export default function ParentLms(){ return <LmsPortal mode="parent" /> }
