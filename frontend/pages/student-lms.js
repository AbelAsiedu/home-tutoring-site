import LmsPortal from '../components/LmsPortal'
import { getExpressUser } from '../lib/express-session-user'

export async function getServerSideProps({ req }) {
  const user = await getExpressUser(req)
  if (user?.role !== 'student') return { redirect: { destination: '/login?next=/student-lms', permanent: false } }
  return { props: {} }
}

export default function StudentLms(){ return <LmsPortal mode="student" /> }
