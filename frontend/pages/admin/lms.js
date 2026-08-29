import LmsPortal from '../../components/LmsPortal'
import { getExpressUser } from '../../lib/express-session-user'

export async function getServerSideProps({ req }) {
  const user = await getExpressUser(req)
  if (user?.role !== 'admin') return { redirect: { destination: '/login?next=/admin/lms', permanent: false } }
  return { props: {} }
}

export default function AdminLms(){ return <LmsPortal mode="admin" /> }
