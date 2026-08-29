import LmsPortal from '../components/LmsPortal'
import { getExpressUser } from '../lib/express-session-user'

export async function getServerSideProps({ req }) {
  const user = await getExpressUser(req)
  if (user?.role !== 'parent') return { redirect: { destination: '/login?next=/parent-lms', permanent: false } }
  return { props: {} }
}

export default function ParentLms(){ return <LmsPortal mode="parent" /> }
