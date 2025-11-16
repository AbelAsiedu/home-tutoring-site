export async function safeFetchJson(url, opts){
  try{
    const res = await fetch(url, Object.assign({credentials:'include'}, opts || {}))
    if (!res.ok) {
      const text = await res.text().catch(()=>null)
      const err = new Error('HTTP '+res.status+' '+res.statusText)
      err.status = res.status
      err.body = text
      throw err
    }
    return await res.json()
  } catch (e){
    console.error('API fetch error', url, e)
    throw e
  }
}

export const swrFetcher = (url) => safeFetchJson(url)
