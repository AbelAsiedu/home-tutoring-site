import LmsPortal from '../components/LmsPortal'
import { getExpressUser } from '../lib/express-session-user'

export async function getServerSideProps({ req }) {
  const user = await getExpressUser(req)
  if (!['tutor','teacher','admin'].includes(user?.role)) return { redirect: { destination: '/login?next=/tutor-lms', permanent: false } }
  return { props: {} }
}

export default function TutorLms(){ return <LmsPortal mode="tutor" /> }
