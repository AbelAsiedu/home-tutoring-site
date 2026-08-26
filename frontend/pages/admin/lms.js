import LmsPortal from '../../components/LmsPortal'

export async function getServerSideProps({ req }) {
  const role = (typeof req.getUserRole === 'function' && req.getUserRole()) || req.session?.user?.role
  if (role !== 'admin') return { redirect: { destination: '/login?next=/admin/lms', permanent: false } }
  return { props: {} }
}

export default function AdminLms(){ return <LmsPortal mode="admin" /> }
