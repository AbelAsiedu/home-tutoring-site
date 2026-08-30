import { useEffect } from 'react'
import LmsPortalV2 from './LmsPortalV2'

export default function LmsPortal(props){
  useEffect(()=>{
    const rewrite=()=>document.querySelectorAll('a[href^="/api/lms-download"]').forEach(a=>{a.href=a.href.replace('/api/lms-download','/api/lms-file')})
    rewrite()
    const observer=new MutationObserver(rewrite)
    observer.observe(document.body,{subtree:true,childList:true})
    return()=>observer.disconnect()
  },[])
  return <LmsPortalV2 {...props}/>
}
